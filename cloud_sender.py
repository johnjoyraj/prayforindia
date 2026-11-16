"""
Cloud Automated Pray for India WhatsApp Broadcaster
Designed to run on GitHub Actions at 4:00 AM IST daily without requiring a local computer.
Connects with Firebase Realtime Database (adonaibroadcast-11095) & WhatsApp Cloud API.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import datetime
import time

FIREBASE_BASE_URL = os.environ.get("FIREBASE_BASE_URL", "https://adonaibroadcast-11095.firebaseio.com/prayforindia")

# ─── 1. EXTRACT TODAY'S PRAYER GUIDE ─────────────────────────────
def get_today_prayer_data():
    day_num = datetime.datetime.now().day
    day_num = max(1, min(day_num, 31))

    # Priority 1: Local prayforindia index.html
    local_path = "E:/MYWORKSPACE/prayforindia/index.html"
    html = ""
    if os.path.exists(local_path):
        with open(local_path, "r", encoding="utf-8") as f:
            html = f.read()
    elif os.path.exists("index.html"):
        with open("index.html", "r", encoding="utf-8") as f:
            html = f.read()
    else:
        # Fallback Priority 2: Online GitHub repository raw file
        url = "https://raw.githubusercontent.com/johnjoyraj/prayforindia/main/index.html"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            html = resp.read().decode('utf-8')

    marker = "const PRAYER_DATA = "
    idx = html.find(marker)
    if idx == -1:
        raise ValueError("Could not locate PRAYER_DATA in prayforindia index.html")

    json_str = html[idx + len(marker):].lstrip()
    data, _ = json.JSONDecoder().raw_decode(json_str)

    day_obj = next((item for item in data.get("days", []) if item.get("day") == day_num), None)
    if not day_obj:
        raise ValueError(f"Day {day_num} not found in prayer dataset")

    return data, day_obj, day_num


def format_prayer_message(data, day_obj, day_num, lang="en", recipient_name=""):
    eff_lang = lang if lang in ["en", "ml", "hi"] else "en"
    ui = data.get("ui", {})
    labels = ui.get("labels", {})

    site_title = ui.get("siteTitle", {}).get(eff_lang, "Daily Prayer Book for India")
    day_label = labels.get("day", {}).get(eff_lang, "Day")
    state_name = day_obj.get("name", {}).get(eff_lang, "")
    capital_label = labels.get("capital", {}).get(eff_lang, "Capital")
    capital_val = day_obj.get("capital", {}).get(eff_lang, "")
    cm_label = labels.get("chiefMinister", {}).get(eff_lang, "Chief Minister")
    cm_val = day_obj.get("cm", {}).get(eff_lang, "")
    demographics = day_obj.get("demographics", {}).get(eff_lang, "")

    greeting = f"Good morning {recipient_name}! ☀️\n\n" if recipient_name else ""
    if eff_lang == "ml":
        greeting = f"സുപ്രഭാതം {recipient_name}! ☀️\n\n" if recipient_name else ""

    lines = [
        f"🙏 *{site_title} — {day_label} {day_num}: {state_name}*",
        f"🏛️ {capital_label}: {capital_val} | {cm_label}: {cm_val}",
        f"📊 {demographics}",
        ""
    ]

    for i, p in enumerate(day_obj.get("prayers", []), 1):
        p_title = p.get("title", {}).get(eff_lang, "")
        p_desc = p.get("desc", {}).get(eff_lang, "")
        lines.append(f"{i}. *{p_title}*: {p_desc}")

    verse = "1 Timothy 2:1-2"
    closing = f"\n_Let us stand in the gap and lift up our nation in prayer today! 🙏 ({verse})_"
    if eff_lang == "ml":
        closing = f"\n_നമുക്കൊന്നായി ഭാരതത്തിനായി പ്രാർത്ഥിക്കാം! 🙏 ({verse})_"

    lines.append(closing)
    return greeting + "\n".join(lines)


# ─── 2. PULL SUBSCRIBERS FROM FIREBASE ──────────────────────────
def get_subscribers_from_firebase():
    subscribers = []
    firebase_auth = os.environ.get("FIREBASE_AUTH", "")
    auth_query = f"?auth={firebase_auth}" if firebase_auth else ""

    # A. Check /subscribers
    try:
        url = f"{FIREBASE_BASE_URL}/subscribers.json{auth_query}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode('utf-8')
            if raw and raw != "null":
                data = json.loads(raw)
                for k, v in data.items():
                    if isinstance(v, dict) and v.get("phone"):
                        subscribers.append({
                            "name": v.get("name", "Prayer Partner"),
                            "phone": v.get("phone"),
                            "lang": v.get("lang", "en"),
                            "source": "firebase_subscribers"
                        })
    except Exception as e:
        print(f"Note on Firebase subscribers fetch: {e}")

    # B. Check /participants
    try:
        url = f"{FIREBASE_BASE_URL}/participants.json{auth_query}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode('utf-8')
            if raw and raw != "null":
                data = json.loads(raw)
                for k, v in data.items():
                    if isinstance(v, dict) and v.get("phone"):
                        subscribers.append({
                            "name": v.get("fullName") or v.get("username", "Intercessor"),
                            "phone": v.get("phone"),
                            "lang": v.get("preferredLang", "en"),
                            "source": "firebase_participants"
                        })
    except Exception as e:
        pass

    # C. Target Phone Numbers Environment Variable (GitHub Secret)
    env_phones = os.environ.get("TARGET_PHONE_NUMBERS", "")
    if env_phones:
        for p in env_phones.split(","):
            clean = p.strip()
            if clean:
                subscribers.append({
                    "name": "Prayer Partner",
                    "phone": clean,
                    "lang": "en",
                    "source": "github_secret"
                })

    # Deduplicate by phone
    seen = set()
    unique = []
    for s in subscribers:
        digits = "".join(filter(str.isdigit, s["phone"]))
        if digits and digits not in seen:
            seen.add(digits)
            unique.append(s)

    return unique


# ─── 3. SEND MESSAGE VIA WHATSAPP CLOUD API ─────────────────────
def send_whatsapp(to_phone, message_text):
    phone_id = os.environ.get("WHATSAPP_PHONE_ID")
    token = os.environ.get("WHATSAPP_API_TOKEN")

    clean_digits = "".join(filter(str.isdigit, str(to_phone)))

    # If credentials not set, run in safe simulation mode
    if not phone_id or not token:
        print(f"ℹ️ [SIMULATION MODE] No API Token provided. Simulating dispatch to: {clean_digits}")
        print(f"Message preview: {message_text[:140]}...\n")
        return True, "Simulated successfully"

    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_digits,
        "type": "text",
        "text": {"preview_url": False, "body": message_text}
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            msg_id = data.get("messages", [{}])[0].get("id", "unknown")
            print(f"✔ Delivered to {clean_digits} (ID: {msg_id})")
            return True, msg_id
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"✖ Error sending to {clean_digits}: {err_msg}")
        return False, err_msg
    except Exception as e:
        print(f"✖ Exception for {clean_digits}: {e}")
        return False, str(e)


# ─── 4. LOG AUDIT RESULT TO FIREBASE ────────────────────────────
def log_to_firebase(log_data):
    try:
        log_id = int(time.time() * 1000)
        url = f"{FIREBASE_BASE_URL}/broadcast_logs/{log_id}.json"
        req = urllib.request.Request(
            url,
            data=json.dumps(log_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="PUT"
        )
        with urllib.request.urlopen(req) as resp:
            print("✔ Execution audit record saved to Firebase.")
    except Exception as e:
        print(f"Notice: could not write audit log to Firebase: {e}")


def main():
    print("═══════════════════════════════════════════════════════════════")
    print("  CLOUD PRAY FOR INDIA 4:00 AM AUTOMATED DISPATCH ENGINE")
    print("═══════════════════════════════════════════════════════════════")

    try:
        data, day_obj, day_num = get_today_prayer_data()
        state_en = day_obj.get("name", {}).get("en", "")
        print(f"Today is Day {day_num} of 31 — Nation Focus: {state_en}")
    except Exception as e:
        print(f"Critical error loading prayer data: {e}")
        sys.exit(1)

    subscribers = get_subscribers_from_firebase()
    print(f"Total eligible subscribers loaded: {len(subscribers)}")

    if not subscribers:
        print("No subscribers currently registered. You can add numbers in GitHub Secrets (TARGET_PHONE_NUMBERS) or in Firebase.")
        return

    sent_count = 0
    failed_count = 0

    for i, s in enumerate(subscribers, 1):
        lang = s.get("lang", "en")
        msg = format_prayer_message(data, day_obj, day_num, lang=lang, recipient_name=s.get("name", ""))
        print(f"[{i}/{len(subscribers)}] Sending ({lang.upper()}) to {s['name']} ({s['phone']})...")

        ok, result = send_whatsapp(s["phone"], msg)
        if ok:
            sent_count += 1
        else:
            failed_count += 1

        # Brief rate limit delay between API calls
        time.sleep(1)

    # Record log in Firebase
    log_record = {
        "timestamp": datetime.datetime.now().isoformat(),
        "day": day_num,
        "state": state_en,
        "total": len(subscribers),
        "sent": sent_count,
        "failed": failed_count,
        "status": "COMPLETED"
    }
    log_to_firebase(log_record)

    print(f"\nBroadcast completed! Sent: {sent_count} | Failed: {failed_count}")


if __name__ == "__main__":
    main()
