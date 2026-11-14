(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    LANG: 'india_prayer_lang',
    PRAYED_DAYS: 'india_prayed_days',
    PRAYED_POINTS: 'india_prayed_points',
    PRAYER_REQUESTS: 'india_prayer_requests',
    PRAYED_REQ_IDS: 'india_prayed_request_ids',
    PARTICIPANTS: 'india_prayer_participants',
    PARTICIPANT_SESSION: 'india_prayer_participant_session',
    ADMIN_AUTH: 'india_prayer_admin_auth',
    ADMIN_LOCKOUT: 'india_prayer_admin_lockout',
    ADMIN_SESSION: 'india_prayer_admin_session',
    SECURITY_LOG: 'india_prayer_security_log',
    SYNC_SIGNAL: 'india_prayer_sync_signal'
  };

  const DEFAULT_ADMIN_USER = 'admin';
  const DEFAULT_ADMIN_PASS = 'IndiaPrayer@2026';
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  const TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const syncListeners = [];
  let broadcastChannel = null;
  // =========================================================================
  // FIREBASE CLOUD DATABASE SYNCHRONIZATION (ADONAI BROADCAST PROJECT)
  // =========================================================================
  const FIREBASE_BASE_URL = 'https://adonaibroadcast-11095.firebaseio.com/prayforindia';
  let firebaseConnected = true;

  async function fbGet(path) {
    try {
      const res = await fetch(FIREBASE_BASE_URL + path + '.json', { cache: 'no-store' });
      if (res.ok) {
        firebaseConnected = true;
        return await res.json();
      }
    } catch (e) {
      firebaseConnected = false;
    }
    return null;
  }

  async function fbPut(path, data) {
    try {
      const res = await fetch(FIREBASE_BASE_URL + path + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        firebaseConnected = true;
        return await res.json();
      }
    } catch (e) {
      firebaseConnected = false;
    }
    return null;
  }

  async function fbPatch(path, data) {
    try {
      const res = await fetch(FIREBASE_BASE_URL + path + '.json', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        firebaseConnected = true;
        return await res.json();
      }
    } catch (e) {
      firebaseConnected = false;
    }
    return null;
  }

  async function fbDelete(path) {
    try {
      const res = await fetch(FIREBASE_BASE_URL + path + '.json', { method: 'DELETE' });
      if (res.ok) {
        firebaseConnected = true;
        return true;
      }
    } catch (e) {
      firebaseConnected = false;
    }
    return false;
  }


  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('india_prayer_guide_sync');
      broadcastChannel.onmessage = function (ev) {
        if (ev && ev.data && ev.data.sourceTabId !== TAB_ID) {
          notifyListeners(ev.data.type || 'broadcast', ev.data);
        }
      };
    }
  } catch (e) {
    // BroadcastChannel not supported
  }

  window.addEventListener('storage', function (ev) {
    if (!ev || !ev.key) return;
    if (Object.values(STORAGE_KEYS).indexOf(ev.key) !== -1) {
      notifyListeners(ev.key, { key: ev.key, newValue: ev.newValue });
    }
  });

  function notifyListeners(type, detail) {
    syncListeners.forEach(function (fn) {
      try {
        fn(type, detail);
      } catch (e) {
        console.error('Sync listener error:', e);
      }
    });
  }

  function emitSync(type, extra) {
    const payload = Object.assign(
      {
        type: type,
        timestamp: Date.now(),
        sourceTabId: TAB_ID
      },
      extra || {}
    );
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_SIGNAL, JSON.stringify(payload));
    } catch (e) {}
    try {
      if (broadcastChannel) {
        broadcastChannel.postMessage(payload);
      }
    } catch (e) {}
    notifyListeners(type, payload);
  }

  function safeGetJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSetJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  const CATEGORIES = {
    nation: {
      id: 'nation',
      icon: '🇮🇳',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      ml: 'രാജ്യത്തിന്റെ സമാധാനവും പുരോഗതിയും',
      hi: 'राष्ट्र की शांति और प्रगति',
      en: 'National Peace & Welfare'
    },
    leadership: {
      id: 'leadership',
      icon: '🏛️',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      ml: 'ദേശീയ-സംസ്ഥാന ഭരണനേതൃത്വം',
      hi: 'राष्ट्रीय एवं राज्य नेतृत्व',
      en: 'National & State Leadership'
    },
    persecution: {
      id: 'persecution',
      icon: '🛡️',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
      ml: 'പീഡിപ്പിക്കപ്പെടുന്ന സഭ / സംരക്ഷണം',
      hi: 'सताई गई कलीसिया और सुरक्षा',
      en: 'Persecuted Church & Protection'
    },
    unreached: {
      id: 'unreached',
      icon: '🌾',
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
      ml: 'സുവിശേഷം എത്താത്ത പ്രദേശങ്ങൾ',
      hi: 'सुसमाचार से वंचित क्षेत्र',
      en: 'Unreached Regions (< 0.5%)'
    },
    church: {
      id: 'church',
      icon: '⛪',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
      ml: 'സഭാ ശുശ്രൂഷയും സുവിശേഷകന്മാരും',
      hi: 'कलीसिया सेवकाई और पासबान',
      en: 'Church Ministry & Pastors'
    },
    youth: {
      id: 'youth',
      icon: '🎓',
      badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
      ml: 'യുവജനങ്ങളും കുടുംബങ്ങളും',
      hi: 'युवा पीढ़ी और परिवार',
      en: 'Youth & Families'
    },
    revival: {
      id: 'revival',
      icon: '🔥',
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
      ml: 'ആത്മീയ ഉണർവ് (Revival)',
      hi: 'आत्मिक जागृति (Revival)',
      en: 'Spiritual Revival'
    },
    personal: {
      id: 'personal',
      icon: '🙏',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      ml: 'വ്യക്തിപരമായ / കുടുംബ ആവശ്യം',
      hi: 'व्यक्तिगत एवं पारिवारिक प्रार्थना',
      en: 'Personal & Family Need'
    }
  };

  const STATES_LIST = [
    { day: 0, ml: 'ഇന്ത്യ മുഴുവൻ (ദേശീയ വിഷയം)', hi: 'संपूर्ण भारत (राष्ट्रीय विषय)', en: 'All India (National Focus)' },
    { day: 1, ml: 'ദിവസം 1: ആന്ധ്രാപ്രദേശ്', hi: 'दिन 1: आंध्र प्रदेश', en: 'Day 1: Andhra Pradesh' },
    { day: 2, ml: 'ദിവസം 2: അരുണാചൽ പ്രദേശ്', hi: 'दिन 2: अरुणाचल प्रदेश', en: 'Day 2: Arunachal Pradesh' },
    { day: 3, ml: 'ദിവസം 3: അസം', hi: 'दिन 3: असम', en: 'Day 3: Assam' },
    { day: 4, ml: 'ദിവസം 4: ബീഹാർ', hi: 'दिन 4: बिहार', en: 'Day 4: Bihar' },
    { day: 5, ml: 'ദിവസം 5: ഛത്തീസ്ഗഡ്', hi: 'दिन 5: छत्तीसगढ़', en: 'Day 5: Chhattisgarh' },
    { day: 6, ml: 'ദിവസം 6: ഗോവ', hi: 'दिन 6: गोवा', en: 'Day 6: Goa' },
    { day: 7, ml: 'ദിവസം 7: ഗുജറാത്ത്', hi: 'दिन 7: गुजरात', en: 'Day 7: Gujarat' },
    { day: 8, ml: 'ദിവസം 8: ഹരിയാന', hi: 'दिन 8: हरियाणा', en: 'Day 8: Haryana' },
    { day: 9, ml: 'ദിവസം 9: ഹിമാചൽ പ്രദേശ്', hi: 'दिन 9: हिमाचल प्रदेश', en: 'Day 9: Himachal Pradesh' },
    { day: 10, ml: 'ദിവസം 10: ജാർഖണ്ഡ്', hi: 'दिन 10: झारखंड', en: 'Day 10: Jharkhand' },
    { day: 11, ml: 'ദിവസം 11: കർണാടക', hi: 'दिन 11: कर्नाटक', en: 'Day 11: Karnataka' },
    { day: 12, ml: 'ദിവസം 12: കേരളം', hi: 'दिन 12: केरल', en: 'Day 12: Kerala' },
    { day: 13, ml: 'ദിവസം 13: മധ്യപ്രദേശ്', hi: 'दिन 13: मध्य प्रदेश', en: 'Day 13: Madhya Pradesh' },
    { day: 14, ml: 'ദിവസം 14: മഹാരാഷ്ട്ര', hi: 'दिन 14: महाराष्ट्र', en: 'Day 14: Maharashtra' },
    { day: 15, ml: 'ദിവസം 15: മണിപ്പൂർ', hi: 'दिन 15: मणिपुर', en: 'Day 15: Manipur' },
    { day: 16, ml: 'ദിവസം 16: മേഘാലയ', hi: 'दिन 16: मेघालय', en: 'Day 16: Meghalaya' },
    { day: 17, ml: 'ദിവസം 17: മിസോറാം', hi: 'दिन 17: मिज़ोरम', en: 'Day 17: Mizoram' },
    { day: 18, ml: 'ദിവസം 18: നാഗാലാൻഡ്', hi: 'दिन 18: नागालैंड', en: 'Day 18: Nagaland' },
    { day: 19, ml: 'ദിവസം 19: ഒഡീഷ', hi: 'दिन 19: ओडिशा', en: 'Day 19: Odisha' },
    { day: 20, ml: 'ദിവസം 20: പഞ്ചാബ്', hi: 'दिन 20: पंजाब', en: 'Day 20: Punjab' },
    { day: 21, ml: 'ദിവസം 21: രാജസ്ഥാൻ', hi: 'दिन 21: राजस्थान', en: 'Day 21: Rajasthan' },
    { day: 22, ml: 'ദിവസം 22: സിക്കിം', hi: 'दिन 22: सिक्किम', en: 'Day 22: Sikkim' },
    { day: 23, ml: 'ദിവസം 23: തമിഴ്‌നാട്', hi: 'दिन 23: तमिलनाडु', en: 'Day 23: Tamil Nadu' },
    { day: 24, ml: 'ദിവസം 24: തെലങ്കാന', hi: 'दिन 24: तेलंगाना', en: 'Day 24: Telangana' },
    { day: 25, ml: 'ദിവസം 25: ത്രിപുര', hi: 'दिन 25: त्रिपुरा', en: 'Day 25: Tripura' },
    { day: 26, ml: 'ദിവസം 26: ഉത്തർപ്രദേശ്', hi: 'दिन 26: उत्तर प्रदेश', en: 'Day 26: Uttar Pradesh' },
    { day: 27, ml: 'ദിവസം 27: ഉത്തരാഖണ്ഡ്', hi: 'दिन 27: उत्तराखंड', en: 'Day 27: Uttarakhand' },
    { day: 28, ml: 'ദിവസം 28: പശ്ചിമ ബംഗാൾ', hi: 'दिन 28: पश्चिम बंगाल', en: 'Day 28: West Bengal' },
    { day: 29, ml: 'ദിവസം 29: ആൻഡമാൻ നിക്കോബാർ & ലക്ഷദ്വീപ്', hi: 'दिन 29: अंडमान-निकोबार एवं लक्षद्वीप', en: 'Day 29: Andaman & Nicobar and Lakshadweep' },
    { day: 30, ml: 'ദിവസം 30: ഡൽഹി, ചണ്ഡീഗഡ് & പുതുച്ചേരി', hi: 'दिन 30: दिल्ली, चंडीगढ़ एवं पुदुचेरी', en: 'Day 30: Delhi, Chandigarh & Puducherry' },
    { day: 31, ml: 'ദിവസം 31: ജമ്മു കാശ്മീർ, ലഡാക്ക് & ദാദ്ര-ദാമൻ', hi: 'दिन 31: जम्मू-कश्मीर, लद्दाख एवं दादरा-दमन', en: 'Day 31: Jammu & Kashmir, Ladakh & Dadra-Daman' }
  ];

  const DEFAULT_REQUESTS = [
    {
      id: 1,
      clientId: 'seed-req-1',
      requesterName: 'Pr. Samuel Varghese',
      location: 'New Delhi / National',
      stateDay: 30,
      category: 'leadership',
      title: {
        ml: 'രാജ്യത്തിന്റെ സമാധാനത്തിനും ഭരണനേതാക്കളുടെ ജ്ഞാനത്തിനും വേണ്ടി',
        hi: 'देश की शांति और राष्ट्रीय नेताओं के ज्ञान के लिए प्रार्थना',
        en: 'For National Peace and Wisdom for Governing Leaders'
      },
      content: {
        ml: 'ഇന്ത്യയുടെ രാഷ്ട്രപതി, പ്രധാനമന്ത്രി, ക്യാബിനറ്റ് മന്ത്രിമാർ, പാർലമെന്റ് അംഗങ്ങൾ, നീതിന്യായ വ്യവസ്ഥ എന്നിവർ നീതിയോടും സത്യത്തോടും കൂടെ ജനങ്ങളെ നയിക്കേണ്ടതിനും രാജ്യത്ത് സമാധാനം നിലനിൽക്കേണ്ടതിനും വേണ്ടി പ്രാർത്ഥിക്കുക.',
        hi: 'भारत के राष्ट्रपति, प्रधानमंत्री, कैबिनेट मंत्रियों, संसद सदस्यों और न्यायपालिका के लिए प्रार्थना करें कि वे न्याय, सत्य और करुणा के साथ देश का नेतृत्व करें और पूरे राष्ट्र में शांति बनी रहे।',
        en: 'Pray for the President, Prime Minister, Cabinet Ministers, Members of Parliament, and the Judiciary of India to lead with justice, truth, and compassion, preserving peace across the nation.'
      },
      isUrgent: false,
      status: 'approved',
      prayerCount: 142,
      adminNote: {
        ml: '1 തിമൊഥെയൊസ് 2:1-2 പ്രകാരം അനുദിനം മധ്യസ്ഥത വഹിക്കാം.',
        hi: '1 तीमुथियुस 2:1-2 के अनुसार प्रतिदिन मध्यस्थता प्रार्थना करें।',
        en: 'Let us intercede daily in accordance with 1 Timothy 2:1-2.'
      },
      submittedBy: 'intercessor',
      createdAt: '2026-11-01T08:30:00.000Z',
      updatedAt: '2026-11-01T08:30:00.000Z'
    },
    {
      id: 2,
      clientId: 'seed-req-2',
      requesterName: 'Sis. Anugraha Masih',
      location: 'Uttar Pradesh & Bihar',
      stateDay: 26,
      category: 'unreached',
      title: {
        ml: 'ഉത്തരേന്ത്യയിലെ സുവിശേഷം എത്താത്ത ഗ്രാമങ്ങൾക്കും സഭകൾക്കും വേണ്ടി',
        hi: 'उत्तर भारत के सुसमाचार से वंचित गाँवों और कलीसियाओं के लिए',
        en: 'For Unreached Villages and Believers Across North India'
      },
      content: {
        ml: 'ക്രൈസ്തവ ജനസംഖ്യ 0.5 ശതമാനത്തിൽ താഴെയുള്ള ഉത്തർപ്രദേശ്, ബീഹാർ, രാജസ്ഥാൻ, മധ്യപ്രദേശ്, ഹിമാചൽ പ്രദേശ് തുടങ്ങിയ സംസ്ഥാനങ്ങളിലെ ഗ്രാമങ്ങളിൽ ദൈവസ്നേഹവും സമാധാനവും എത്തുവാനും അവിടെയുള്ള വിശ്വാസികളുടെ സംരക്ഷണത്തിനും വേണ്ടി പ്രാർത്ഥിക്കുക.',
        hi: 'उत्तर प्रदेश, बिहार, राजस्थान, मध्य प्रदेश और हिमाचल प्रदेश जैसे राज्यों में जहाँ ईसाई जनसंख्या 0.5% से कम है, वहाँ के प्रत्येक गाँव में परमेश्वर का प्रेम और शांति पहुँचने तथा विश्वासियों की सुरक्षा के लिए प्रार्थना करें।',
        en: "Pray for the light of God's love and peace to reach every village in states with less than 0.5% Christian population—including Uttar Pradesh, Bihar, Rajasthan, Madhya Pradesh, and Himachal Pradesh—and for the safety of local congregations."
      },
      isUrgent: true,
      status: 'approved',
      prayerCount: 198,
      adminNote: {
        ml: 'പ്രത്യേക പ്രാർത്ഥനാ വിഷയം: ദിവസം 4, 9, 13, 21, 26.',
        hi: 'विशेष प्रार्थना विषय: दिन 4, 9, 13, 21, 26।',
        en: 'Special focus for Days 4, 9, 13, 21, and 26.'
      },
      submittedBy: 'intercessor',
      createdAt: '2026-11-01T11:15:00.000Z',
      updatedAt: '2026-11-01T11:15:00.000Z'
    },
    {
      id: 3,
      clientId: 'seed-req-3',
      requesterName: 'Bro. Lalhmangaiha & Youth Fellowship',
      location: 'Manipur & Northeast India',
      stateDay: 15,
      category: 'persecution',
      title: {
        ml: 'മണിപ്പൂരിലെയും പീഡിപ്പിക്കപ്പെടുന്ന പ്രദേശങ്ങളിലെയും സമാധാനത്തിനും പുനരധിവാസത്തിനും വേണ്ടി',
        hi: 'मणिपुर और पीड़ित क्षेत्रों में शांति, मेल-मिलाप और पुनर्वास के लिए',
        en: 'For Peace, Reconciliation, and Restoration in Manipur & Affected Regions'
      },
      content: {
        ml: 'കലാപങ്ങളാലും ആക്രമണങ്ങളാലും ഭവനങ്ങളും ആരാധനാലയങ്ങളും നഷ്ടപ്പെട്ട കുടുംബങ്ങൾക്ക് ആശ്വാസവും പുനരധിവാസവും ലഭിക്കുവാനും, വിവിധ ഗോത്ര വിഭാഗങ്ങൾക്കിടയിൽ ശാശ്വത സമാധാനവും പരസ്പര ക്ഷമയും ഉണ്ടാകുവാനും വേണ്ടി അടിയന്തരമായി പ്രാർത്ഥിക്കുക.',
        hi: 'संघर्ष और हिंसा के कारण अपने घर और आराधनालय खो चुके परिवारों के पुनर्वास व सांत्वना के लिए, तथा विभिन्न समुदायों के बीच स्थायी शांति, क्षमा और भाईचारे की बहाली के लिए विशेष प्रार्थना करें।',
        en: 'Urgent prayer for comfort and rehabilitation for displaced families who lost homes and churches, and for lasting peace, forgiveness, and harmony among all communities.'
      },
      isUrgent: true,
      status: 'approved',
      prayerCount: 276,
      adminNote: {
        ml: 'ദുരിതമനുഭവിക്കുന്ന കുടുംബങ്ങളെ കർത്താവ് ആശ്വസിപ്പിക്കട്ടെ.',
        hi: 'प्रभु पीड़ित परिवारों को अपनी दिव्य शांति और सहायता प्रदान करें।',
        en: 'May the Lord grant divine comfort and restoration to every affected family.'
      },
      submittedBy: 'intercessor',
      createdAt: '2026-11-02T06:20:00.000Z',
      updatedAt: '2026-11-02T06:20:00.000Z'
    },
    {
      id: 4,
      clientId: 'seed-req-4',
      requesterName: 'Dr. Rajesh Sharma',
      location: 'Maharashtra & Karnataka',
      stateDay: 14,
      category: 'youth',
      title: {
        ml: 'ഇന്ത്യയിലെ യുവജനങ്ങളുടെ ഭാവിക്കും തൊഴിലിനും മാനസികാരോഗ്യത്തിനും വേണ്ടി',
        hi: 'भारत के युवाओं के भविष्य, रोज़गार और मानसिक स्वास्थ्य के लिए',
        en: "For India's Youth: Purpose, Employment, and Deliverance from Addiction"
      },
      content: {
        ml: 'ലഹരിവസ്തുക്കളുടെ അടിമത്തം, തൊഴിലില്ലായ്മ, വിഷാദരോഗം എന്നിവയിൽ നിന്ന് നമ്മുടെ യുവതലമുറ വിടുവിക്കപ്പെടുവാനും, അവർ ദൈവഭയവും മൂല്യബോധവുമുള്ള പൗരന്മാരായി വളരുവാനും വേണ്ടി പ്രാർത്ഥിക്കുക.',
        hi: 'हमारी युवा पीढ़ी को नशे की लत, बेरोज़गारी और निराशा से छुटकारा मिलने तथा उनके भीतर नैतिक मूल्यों, आशा और उज्ज्वल भविष्य के निर्माण के लिए प्रार्थना करें।',
        en: "Pray for the deliverance of India's young generation from substance abuse, unemployment, and despair, and that they may walk in hope, moral integrity, and God-given purpose."
      },
      isUrgent: false,
      status: 'answered',
      prayerCount: 164,
      adminNote: {
        ml: 'യുവജനങ്ങൾക്കിടയിൽ നടന്ന ക്യാമ്പുകളിലൂടെ അനേകർ വിടുതൽ പ്രാപിച്ചു! ദൈവത്തിന് സ്തോത്രം.',
        hi: 'युवा शिविरों के माध्यम से अनेक युवाओं के जीवन में सकारात्मक परिवर्तन आया! परमेश्वर का धन्यवाद।',
        en: 'Praise Report: Many young people experienced renewal and hope through regional youth initiatives!'
      },
      submittedBy: 'public',
      createdAt: '2026-11-02T14:10:00.000Z',
      updatedAt: '2026-11-02T18:00:00.000Z'
    },
    {
      id: 5,
      clientId: 'seed-req-5',
      requesterName: 'Evg. Yohannan Thomas',
      location: 'Chhattisgarh & Odisha',
      stateDay: 5,
      category: 'church',
      title: {
        ml: 'ഗ്രാമീണ സുവിശേഷകന്മാരുടെയും ആരാധനാ സ്വാതന്ത്ര്യത്തിന്റെയും സംരക്ഷണത്തിനായി',
        hi: 'ग्रामीण सेवकों की सुरक्षा और आराधना की स्वतंत्रता के लिए',
        en: 'For Protection of Rural Pastors and Freedom of Worship'
      },
      content: {
        ml: 'ഛത്തീസ്ഗഡ്, ഒഡീഷ, ജാർഖണ്ഡ് എന്നിവിടങ്ങളിലെ ഉൾഗ്രാമങ്ങളിൽ ശുശ്രൂഷ ചെയ്യുന്ന കർത്താവിന്റെ ദാസന്മാരുടെ സംരക്ഷണത്തിനും ഭരണഘടനാപരമായ ആരാധനാ സ്വാതന്ത്ര്യം സംരക്ഷിക്കപ്പെടുന്നതിനും വേണ്ടി പ്രാർത്ഥിക്കുക.',
        hi: 'छत्तीसगढ़, ओडिशा और झारखंड के दूरदराज़ गाँवों में सेवा करने वाले प्रभु के सेवकों की सुरक्षा तथा संविधान द्वारा प्रदत्त आराधना की स्वतंत्रता की रक्षा के लिए प्रार्थना करें।',
        en: 'Pray for the safety and protection of rural pastors and Christian workers serving in remote areas of Chhattisgarh, Odisha, and Jharkhand, and for constitutional freedom of worship.'
      },
      isUrgent: true,
      status: 'approved',
      prayerCount: 215,
      adminNote: {
        ml: 'ദിവസം 5 (ഛത്തീസ്ഗഡ്), ദിവസം 19 (ഒഡീഷ) എന്നിവയോടൊപ്പം ഓർക്കുക.',
        hi: 'दिन 5 (छत्तीसगढ़) और दिन 19 (ओडिशा) की प्रार्थना के साथ स्मरण करें।',
        en: 'Remember alongside Day 5 (Chhattisgarh) and Day 19 (Odisha).'
      },
      submittedBy: 'intercessor',
      createdAt: '2026-11-02T19:45:00.000Z',
      updatedAt: '2026-11-02T19:45:00.000Z'
    },
    {
      id: 6,
      clientId: 'seed-req-6',
      requesterName: 'Grace Intercessory Group',
      location: 'Kerala & Tamil Nadu',
      stateDay: 12,
      category: 'revival',
      title: {
        ml: 'ഭാരതത്തിലെ സഭകളുടെ ഐക്യത്തിനും ആത്മീയ ഉണർവിനും മിഷനറി ദർശനത്തിനും വേണ്ടി',
        hi: 'भारतीय कलीसियाओं की एकता, आत्मिक जागृति और मिशनरी दर्शन के लिए',
        en: 'For Unity, Spiritual Revival, and Missionary Vision in the Indian Church'
      },
      content: {
        ml: 'ദക്ഷിണേന്ത്യയിലെയും വടക്കുകിഴക്കൻ സംസ്ഥാനങ്ങളിലെയും ക്രൈസ്തവ സഭകൾ ആത്മീയ ഉണർവോടെ എഴുന്നേൽക്കുവാനും ഭാരതത്തിന്റെ എല്ലാ ജില്ലകളിലേക്കും പ്രാർത്ഥനക്കാരെയും ശുശ്രൂഷകരെയും അയയ്ക്കുവാനും വേണ്ടി പ്രാർത്ഥിക്കുക.',
        hi: 'दक्षिण भारत और पूर्वोत्तर राज्यों की कलीसियाओं में गहरी आत्मिक जागृति आने और भारत के प्रत्येक जिले के लिए मध्यस्थता करने वाले प्रार्थना योद्धाओं के खड़े होने के लिए प्रार्थना करें।',
        en: 'Pray for deep spiritual revival and unity across churches in South and Northeast India, raising up committed intercessors and workers for every district of the nation.'
      },
      isUrgent: false,
      status: 'approved',
      prayerCount: 183,
      adminNote: {
        ml: '',
        hi: '',
        en: ''
      },
      submittedBy: 'intercessor',
      createdAt: '2026-11-03T04:00:00.000Z',
      updatedAt: '2026-11-03T04:00:00.000Z'
    }
  ];

  function buildTrilingualContent(payload) {
    const catKey = payload.category && CATEGORIES[payload.category] ? payload.category : 'nation';
    const cat = CATEGORIES[catKey];
    const stateObj = STATES_LIST.find(function (s) { return s.day === Number(payload.stateDay || 0); }) || STATES_LIST[0];
    const loc = (payload.location || stateObj.en || 'India').trim();

    const baseTitle = (payload.title || payload.titleEn || payload.titleHi || payload.titleMl || '').trim();
    const baseContent = (payload.content || payload.contentEn || payload.contentHi || payload.contentMl || '').trim();

    const titleEn = (payload.titleEn || baseTitle || (cat.en + ' — ' + loc)).trim();
    const titleHi = (payload.titleHi || (baseTitle ? cat.hi + ': ' + baseTitle : cat.hi + ' (' + stateObj.hi + ')')).trim();
    const titleMl = (payload.titleMl || (baseTitle ? cat.ml + ': ' + baseTitle : cat.ml + ' (' + stateObj.ml + ')')).trim();

    const contentEn = (payload.contentEn || baseContent || ('Prayer request for ' + loc + ' (' + cat.en + ').')).trim();
    const contentHi = (
      payload.contentHi ||
      (baseContent
        ? 'प्रार्थना निवेदन (' + stateObj.hi + ' • ' + cat.hi + '): ' + baseContent + ' — प्रभु इस प्रार्थना निवेदन को सुनें और अपनी शांति, सुरक्षा व आशीष प्रदान करें।'
        : stateObj.hi + ' के लिए ' + cat.hi + ' के विषय में विशेष प्रार्थना करें।')
    ).trim();
    const contentMl = (
      payload.contentMl ||
      (baseContent
        ? 'പ്രാർത്ഥനാ വിഷയം (' + stateObj.ml + ' • ' + cat.ml + '): ' + baseContent + ' — കർത്താവ് ഈ പ്രാർത്ഥനാ വിഷയത്തിൽ ഇടപെട്ട് സമാധാനവും അനുഗ്രഹവും നൽകട്ടെ.'
        : stateObj.ml + ' പ്രദേശത്തിനും ' + cat.ml + ' എന്ന വിഷയത്തിനും വേണ്ടി പ്രത്യേകം പ്രാർത്ഥിക്കുക.')
    ).trim();

    return {
      title: { ml: titleMl, hi: titleHi, en: titleEn },
      content: { ml: contentMl, hi: contentHi, en: contentEn }
    };
  }

  // Ensure default prayer requests exist in localStorage
  function getPrayerRequests() {
    const stored = safeGetJSON(STORAGE_KEYS.PRAYER_REQUESTS, null);
    if (!stored || !Array.isArray(stored) || stored.length === 0) {
      safeSetJSON(STORAGE_KEYS.PRAYER_REQUESTS, DEFAULT_REQUESTS);
      return DEFAULT_REQUESTS.slice();
    }
    return stored;
  }

  function savePrayerRequestsLocal(requests, triggerSync) {
    safeSetJSON(STORAGE_KEYS.PRAYER_REQUESTS, requests);
    if (triggerSync !== false) {
      emitSync(STORAGE_KEYS.PRAYER_REQUESTS, { count: requests.length });
    }
  }

  async function fetchPrayerRequests() {
    const localList = getPrayerRequests();
    
    // 1. Attempt Firebase Cloud Database first
    try {
      const fbData = await fbGet('/prayers');
      if (fbData && typeof fbData === 'object') {
        const cloudRequests = Array.isArray(fbData) ? fbData.filter(Boolean) : Object.values(fbData).filter(Boolean);
        if (cloudRequests.length > 0) {
          const dbClientIds = {};
          cloudRequests.forEach(function (r) {
            if (r.clientId) dbClientIds[r.clientId] = true;
            if (r.id) dbClientIds['id_' + r.id] = true;
          });
          const merged = cloudRequests.slice();
          localList.forEach(function (locReq) {
            const cid = locReq.clientId || ('id_' + locReq.id);
            if (!dbClientIds[cid] && String(cid).indexOf('seed-req-') === -1) {
              merged.unshift(locReq);
              // Background sync to Firebase
              fbPut('/prayers/' + (locReq.id || Date.now()), locReq);
            }
          });
          // Sort by createdAt descending
          merged.sort(function(a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
          savePrayerRequestsLocal(merged, false);
          return merged;
        }
      }
    } catch (e) {
      // Offline fallback
    }

    // 2. Fallback to /api/prayers if local server is active
    try {
      const res = await fetch('/api/prayers');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.requests) && data.requests.length > 0) {
          savePrayerRequestsLocal(data.requests, false);
          return data.requests;
        }
      }
    } catch (e) {}

    return localList;
  }

  async function submitPrayerRequest(payload) {
    const trilingual = buildTrilingualContent(payload);
    const clientId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const nowIso = new Date().toISOString();
    const newReq = {
      id: Date.now(),
      clientId: clientId,
      requesterName: String(payload.requesterName || payload.name || 'Intercessor').trim() || 'Intercessor',
      location: String(payload.location || 'India').trim() || 'India',
      stateDay: Number(payload.stateDay) || 0,
      category: payload.category && CATEGORIES[payload.category] ? payload.category : 'nation',
      title: trilingual.title,
      content: trilingual.content,
      isUrgent: Boolean(payload.isUrgent),
      status: payload.status || 'approved',
      prayerCount: 1,
      adminNote: {
        ml: String((payload.adminNote && payload.adminNote.ml) || payload.adminNoteMl || ''),
        hi: String((payload.adminNote && payload.adminNote.hi) || payload.adminNoteHi || ''),
        en: String((payload.adminNote && payload.adminNote.en) || payload.adminNoteEn || '')
      },
      submittedBy: payload.submittedBy || 'public',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Optimistically save to localStorage and sync across tabs immediately
    const current = getPrayerRequests();
    current.unshift(newReq);
    savePrayerRequestsLocal(current, true);

    // Sync to Firebase Cloud Realtime Database immediately
    fbPut('/prayers/' + newReq.id, newReq);

    try {
      const res = await fetch('/api/prayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.request) {
          const updatedList = getPrayerRequests().map(function (item) {
            return item.clientId === clientId ? data.request : item;
          });
          savePrayerRequestsLocal(updatedList, true);
          return { ok: true, request: data.request };
        }
      }
    } catch (e) {
      // Keep localStorage version
    }

    return { ok: true, request: newReq };
  }

  function hasPrayedForRequest(idOrClientId) {
    const map = safeGetJSON(STORAGE_KEYS.PRAYED_REQ_IDS, {});
    return Boolean(map[String(idOrClientId)]);
  }

  async function prayForRequest(idOrClientId) {
    const key = String(idOrClientId);
    const prayedMap = safeGetJSON(STORAGE_KEYS.PRAYED_REQ_IDS, {});
    const alreadyPrayed = Boolean(prayedMap[key]);
    prayedMap[key] = true;
    safeSetJSON(STORAGE_KEYS.PRAYED_REQ_IDS, prayedMap);

    let targetReq = null;
    const list = getPrayerRequests().map(function (r) {
      if (String(r.id) === key || String(r.clientId) === key) {
        if (!alreadyPrayed) {
          r.prayerCount = (Number(r.prayerCount) || 0) + 1;
        }
        r.updatedAt = new Date().toISOString();
        targetReq = r;
      }
      return r;
    });

    savePrayerRequestsLocal(list, true);
    emitSync(STORAGE_KEYS.PRAYED_REQ_IDS, { id: key });

    if (!alreadyPrayed && targetReq) {
      // Sync increment to Firebase Realtime Database
      fbPatch('/prayers/' + targetReq.id, {
        prayerCount: targetReq.prayerCount,
        updatedAt: targetReq.updatedAt
      });
      try {
        await fetch('/api/prayers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'pray',
            id: targetReq.id,
            clientId: targetReq.clientId
          })
        });
      } catch (e) {}
    }

    return { ok: true, request: targetReq, alreadyPrayed: alreadyPrayed };
  }

  async function updatePrayerRequest(idOrClientId, updates) {
    const key = String(idOrClientId);
    let updatedItem = null;
    const list = getPrayerRequests().map(function (r) {
      if (String(r.id) === key || String(r.clientId) === key) {
        if (updates.requesterName !== undefined) r.requesterName = updates.requesterName;
        if (updates.location !== undefined) r.location = updates.location;
        if (updates.stateDay !== undefined) r.stateDay = Number(updates.stateDay) || 0;
        if (updates.category !== undefined) r.category = updates.category;
        if (updates.isUrgent !== undefined) {
          r.isUrgent = Boolean(updates.isUrgent);
          r.urgent = Boolean(updates.isUrgent);
        }
        if (updates.urgent !== undefined) {
          r.urgent = Boolean(updates.urgent);
          r.isUrgent = Boolean(updates.urgent);
        }
        if (updates.status !== undefined) r.status = updates.status;
        if (updates.answered !== undefined) r.answered = Boolean(updates.answered);
        if (updates.prayerCount !== undefined) r.prayerCount = Number(updates.prayerCount);
        if (updates.title) {
          r.title = {
            ml: updates.title.ml !== undefined ? updates.title.ml : r.title.ml,
            hi: updates.title.hi !== undefined ? updates.title.hi : r.title.hi,
            en: updates.title.en !== undefined ? updates.title.en : r.title.en
          };
        }
        if (updates.content) {
          r.content = {
            ml: updates.content.ml !== undefined ? updates.content.ml : r.content.ml,
            hi: updates.content.hi !== undefined ? updates.content.hi : r.content.hi,
            en: updates.content.en !== undefined ? updates.content.en : r.content.en
          };
        }
        if (updates.adminNote) {
          r.adminNote = {
            ml: updates.adminNote.ml !== undefined ? updates.adminNote.ml : (r.adminNote ? r.adminNote.ml : ''),
            hi: updates.adminNote.hi !== undefined ? updates.adminNote.hi : (r.adminNote ? r.adminNote.hi : ''),
            en: updates.adminNote.en !== undefined ? updates.adminNote.en : (r.adminNote ? r.adminNote.en : '')
          };
        }
        r.updatedAt = new Date().toISOString();
        updatedItem = r;
      }
      return r;
    });

    savePrayerRequestsLocal(list, true);

    if (updatedItem) {
      // Sync update to Firebase
      fbPatch('/prayers/' + updatedItem.id, updatedItem);
      try {
        await fetch('/api/prayers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ id: updatedItem.id, clientId: updatedItem.clientId }, updates))
        });
      } catch (e) {}
    }

    return { ok: Boolean(updatedItem), request: updatedItem };
  }

  async function deletePrayerRequest(idOrClientId) {
    const key = String(idOrClientId);
    let target = null;
    const list = getPrayerRequests().filter(function (r) {
      const match = String(r.id) === key || String(r.clientId) === key;
      if (match) target = r;
      return !match;
    });

    savePrayerRequestsLocal(list, true);

    // Remove from Firebase
    if (target && target.id) {
      fbDelete('/prayers/' + target.id);
    } else {
      fbDelete('/prayers/' + key);
    }

    try {
      await fetch('/api/prayers?id=' + encodeURIComponent(target ? target.id : key) + '&clientId=' + encodeURIComponent(target ? target.clientId : key), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target ? target.id : key, clientId: target ? target.clientId : key })
      });
    } catch (e) {}

    return { ok: true };
  }

  // Language & 31-Day Progress Sync
  function getLang() {
    try {
      const l = localStorage.getItem(STORAGE_KEYS.LANG);
      if (l && ['ml', 'hi', 'en', 'all'].indexOf(l) !== -1) return l;
    } catch (e) {}
    return 'en';
  }

  function setLang(lang) {
    if (['ml', 'hi', 'en', 'all'].indexOf(lang) === -1) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LANG, lang);
    } catch (e) {}
    emitSync(STORAGE_KEYS.LANG, { lang: lang });
  }

  function getPrayedDays() {
    return safeGetJSON(STORAGE_KEYS.PRAYED_DAYS, {});
  }

  function getPrayedPoints() {
    return safeGetJSON(STORAGE_KEYS.PRAYED_POINTS, {});
  }

  function saveProgress(prayedDays, prayedPoints) {
    safeSetJSON(STORAGE_KEYS.PRAYED_DAYS, prayedDays);
    safeSetJSON(STORAGE_KEYS.PRAYED_POINTS, prayedPoints);
    emitSync(STORAGE_KEYS.PRAYED_DAYS, { prayedDays: prayedDays, prayedPoints: prayedPoints });

    // If a participant is signed in, also sync progress to their profile
    const session = getParticipantSession();
    if (session && session.username) {
      const users = safeGetJSON(STORAGE_KEYS.PARTICIPANTS, []);
      users.forEach(function (u) {
        if (u.username === session.username) {
          u.prayedDays = prayedDays;
          u.prayedPoints = prayedPoints;
        }
      });
      safeSetJSON(STORAGE_KEYS.PARTICIPANTS, users);
      session.prayedDays = prayedDays;
      session.prayedPoints = prayedPoints;
      safeSetJSON(STORAGE_KEYS.PARTICIPANT_SESSION, session);
      try {
        fetch('/api/participants/sync-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync-progress',
            username: session.username,
            prayedDays: prayedDays,
            prayedPoints: prayedPoints
          })
        }).catch(function () {});
      } catch (e) {}
    }
  }

  // Helper: Sanitize keys for Firebase Realtime Database paths
  function toSafeFirebaseKey(key) {
    return String(key || '').toLowerCase().trim().replace(/[.#$[\]/]/g, '_');
  }

  // Participant Portal (login.html) Auth & Online Password Change
  function getLocalParticipants() {
    return safeGetJSON(STORAGE_KEYS.PARTICIPANTS, []);
  }

  async function fetchParticipants() {
    try {
      const fbData = await fbGet('/participants');
      if (fbData && typeof fbData === 'object') {
        const list = Array.isArray(fbData) ? fbData.filter(Boolean) : Object.values(fbData).filter(Boolean);
        if (list.length > 0) {
          safeSetJSON(STORAGE_KEYS.PARTICIPANTS, list);
          return list;
        }
      }
    } catch (e) {}
    return getLocalParticipants();
  }

  function getParticipantSession() {
    return safeGetJSON(STORAGE_KEYS.PARTICIPANT_SESSION, null);
  }

  function setParticipantSession(participant) {
    if (!participant) {
      try {
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_SESSION);
      } catch (e) {}
    } else {
      safeSetJSON(STORAGE_KEYS.PARTICIPANT_SESSION, participant);
      // Merge participant's saved prayer progress if any
      if (participant.prayedDays && Object.keys(participant.prayedDays).length > 0) {
        const mergedDays = Object.assign({}, getPrayedDays(), participant.prayedDays);
        safeSetJSON(STORAGE_KEYS.PRAYED_DAYS, mergedDays);
      }
      if (participant.prayedPoints && Object.keys(participant.prayedPoints).length > 0) {
        const mergedPoints = Object.assign({}, getPrayedPoints(), participant.prayedPoints);
        safeSetJSON(STORAGE_KEYS.PRAYED_POINTS, mergedPoints);
      }
    }
    emitSync(STORAGE_KEYS.PARTICIPANT_SESSION, { participant: participant });
  }

  async function registerParticipant(payload) {
    const username = String(payload.username || payload.email || '').trim().toLowerCase();
    const email = String(payload.email || username).trim().toLowerCase();
    const fullName = String(payload.fullName || payload.name || username).trim();
    const stateRegion = String(payload.stateRegion || payload.state || 'India').trim();
    const commitment = String(payload.commitment || 'Daily 31 Days').trim();
    const preferredLang = String(payload.preferredLang || getLang() || 'en').trim();
    const password = String(payload.password || '');

    if (!username || username.length < 3) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'Username or email must be at least 3 characters.',
          hi: 'उपयोगकर्ता नाम या ईमेल कम से कम 3 अक्षरों का होना चाहिए।',
          ml: 'ഉപയോക്തൃനാമം അല്ലെങ്കിൽ ഇമെയിൽ കുറഞ്ഞത് 3 അക്ഷരമെങ്കിലും ഉണ്ടായിരിക്കണം.'
        }
      };
    }

    if (!password || password.length < 6) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'Password must be at least 6 characters.',
          hi: 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।',
          ml: 'പാസ്‌വേഡ് കുറഞ്ഞത് 6 അക്ഷരമെങ്കിലും ഉണ്ടായിരിക്കണം.'
        }
      };
    }

    const safeKey = toSafeFirebaseKey(username);
    const prayedDays = getPrayedDays();
    const prayedPoints = getPrayedPoints();

    // 1. Check Firebase first
    try {
      const fbExisting = await fbGet('/participants/' + safeKey);
      if (fbExisting) {
        return {
          ok: false,
          errorTrilingual: {
            en: 'This username or email is already registered. Please sign in.',
            hi: 'यह उपयोगकर्ता नाम या ईमेल पहले से पंजीकृत है। कृपया साइन इन करें।',
            ml: 'ഈ ഉപയോക്തൃനാമം ഇതിനകം രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്. ദയവായി സൈൻ ഇൻ ചെയ്യുക.'
          }
        };
      }
    } catch (e) {}

    // 2. Check localStorage
    const localUsers = getLocalParticipants();
    const existsLocal = localUsers.find(function (u) {
      return u.username === username || (email && u.email === email);
    });
    if (existsLocal) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'This username is already registered. Please sign in.',
          hi: 'यह उपयोगकर्ता नाम पहले से पंजीकृत है। कृपया साइन इन करें।',
          ml: 'ഈ ഉപയോക്തൃനാമം ഇതിനകം രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്. ദയവായി സൈൻ ഇൻ ചെയ്യുക.'
        }
      };
    }

    const nowIso = new Date().toISOString();
    const record = {
      id: Date.now(),
      username: username,
      email: email,
      fullName: fullName,
      stateRegion: stateRegion,
      commitment: commitment,
      preferredLang: preferredLang,
      password: password,
      prayedDays: prayedDays,
      prayedPoints: prayedPoints,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 3. Save to Firebase Cloud
    await fbPut('/participants/' + safeKey, record);

    // 4. Save to localStorage
    const filtered = localUsers.filter(function (u) { return u.username !== username; });
    filtered.unshift(record);
    safeSetJSON(STORAGE_KEYS.PARTICIPANTS, filtered);

    const sessionProfile = Object.assign({}, record);
    delete sessionProfile.password;
    setParticipantSession(sessionProfile);
    emitSync(STORAGE_KEYS.PARTICIPANTS, { action: 'register', username: username });

    appendSecurityLog({
      type: 'INTERCESSOR_REGISTERED',
      actor: username,
      detail: 'Registered intercessor from ' + stateRegion + ' (' + commitment + ')'
    });

    return {
      ok: true,
      participant: sessionProfile,
      messageTrilingual: {
        en: 'Registration completed successfully on Firebase Cloud! Welcome.',
        hi: 'पंजीकरण सफलतापूर्वक पूर्ण हुआ! आपका स्वागत है।',
        ml: 'രജിസ്ട്രേഷൻ വിജയകരമായി പൂർത്തിയായി! സ്വാഗതം.'
      }
    };
  }

  async function loginParticipant(identifierInput, passwordInput) {
    const identifier = String(identifierInput || '').trim().toLowerCase();
    const password = String(passwordInput || '');

    if (!identifier || !password) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'Please enter both username/email and password.',
          hi: 'कृपया उपयोगकर्ता नाम और पासवर्ड दोनों दर्ज करें।',
          ml: 'ഉപയോക്തൃനാമവും പാസ്‌വേഡും നൽകുക.'
        }
      };
    }

    const safeKey = toSafeFirebaseKey(identifier);

    // 1. Try Firebase Cloud Database
    try {
      let foundUser = await fbGet('/participants/' + safeKey);

      // If not directly found under safeKey, search all participants
      if (!foundUser) {
        const allFb = await fbGet('/participants');
        if (allFb && typeof allFb === 'object') {
          const userList = Array.isArray(allFb) ? allFb.filter(Boolean) : Object.values(allFb).filter(Boolean);
          foundUser = userList.find(function (u) {
            return (u.username && u.username.toLowerCase() === identifier) ||
                   (u.email && u.email.toLowerCase() === identifier);
          });
        }
      }

      if (foundUser) {
        if (foundUser.password === password) {
          // Sync into localStorage
          const localUsers = getLocalParticipants();
          const others = localUsers.filter(function (u) { return u.username !== foundUser.username; });
          others.unshift(foundUser);
          safeSetJSON(STORAGE_KEYS.PARTICIPANTS, others);

          const sessionProfile = Object.assign({}, foundUser);
          delete sessionProfile.password;
          setParticipantSession(sessionProfile);

          appendSecurityLog({
            type: 'INTERCESSOR_LOGIN_SUCCESS',
            actor: identifier,
            detail: 'Intercessor signed in via Firebase Cloud'
          });

          return { ok: true, participant: sessionProfile };
        } else {
          appendSecurityLog({
            type: 'INTERCESSOR_LOGIN_FAILED',
            actor: identifier,
            detail: 'Incorrect password entered'
          });

          return {
            ok: false,
            errorTrilingual: {
              en: 'Invalid password. Please check your credentials.',
              hi: 'अमान्य पासवर्ड। कृपया अपना विवरण जांचें।',
              ml: 'തെറ്റായ പാസ്‌വേഡ്. ദയവായി പരിശോധിക്കുക.'
            }
          };
        }
      }
    } catch (e) {}

    // 2. Offline fallback to localStorage
    const localUsers = getLocalParticipants();
    const localMatch = localUsers.find(function (u) {
      return (u.username === identifier || u.email === identifier) && u.password === password;
    });

    if (localMatch) {
      const sessionProfile = Object.assign({}, localMatch);
      delete sessionProfile.password;
      setParticipantSession(sessionProfile);
      return { ok: true, participant: sessionProfile };
    }

    return {
      ok: false,
      errorTrilingual: {
        en: 'Invalid username/email or password. If you have not registered yet, click Register.',
        hi: 'अमान्य उपयोगकर्ता नाम या पासवर्ड। यदि आपने अभी तक पंजीकरण नहीं किया है, तो पंजीकरण पर क्लिक करें।',
        ml: 'തെറ്റായ ഉപയോക്തൃനാമം അല്ലെങ്കിൽ പാസ്‌വേഡ്. രജിസ്റ്റർ ചെയ്തിട്ടില്ലെങ്കിൽ രജിസ്റ്റർ ചെയ്യുക.'
      }
    };
  }

  async function changeParticipantPassword(arg1, arg2, arg3) {
    const session = getParticipantSession();
    let identifier = '';
    let currentPassword = '';
    let newPassword = '';

    if (arg3 !== undefined) {
      // 3 arguments passed: (identifier, currentPassword, newPassword)
      identifier = String(arg1 || '').trim().toLowerCase();
      currentPassword = String(arg2 || '');
      newPassword = String(arg3 || '');
    } else {
      // 2 arguments passed: (currentPassword, newPassword) using active session
      identifier = String((session && (session.username || session.email)) || '').trim().toLowerCase();
      currentPassword = String(arg1 || '');
      newPassword = String(arg2 || '');
    }

    if (!identifier || !currentPassword || !newPassword) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'Username, current password, and new password are required.',
          hi: 'उपयोगकर्ता नाम, वर्तमान पासवर्ड और नया पासवर्ड आवश्यक हैं।',
          ml: 'ഉപയോക്തൃനാമം, നിലവിലെ പാസ്‌വേഡ്, പുതിയ പാസ്‌വേഡ് എന്നിവ ആവശ്യമാണ്.'
        }
      };
    }

    if (String(newPassword).length < 6) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'New password must be at least 6 characters.',
          hi: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।',
          ml: 'പുതിയ പാസ്‌വേഡ് കുറഞ്ഞത് 6 അക്ഷരമെങ്കിലും ഉണ്ടായിരിക്കണം.'
        }
      };
    }

    const safeKey = toSafeFirebaseKey(identifier);
    let updatedInFirebase = false;

    // 1. Try Firebase Cloud update
    try {
      const fbUser = await fbGet('/participants/' + safeKey);
      if (fbUser && fbUser.password === currentPassword) {
        const nowIso = new Date().toISOString();
        await fbPatch('/participants/' + safeKey, {
          password: newPassword,
          updatedAt: nowIso
        });
        updatedInFirebase = true;
      }
    } catch (e) {}

    // 2. Update localStorage
    const localUsers = getLocalParticipants();
    let localFound = false;
    let passwordMatched = false;

    localUsers.forEach(function (u) {
      if (u.username === identifier || u.email === identifier) {
        localFound = true;
        if (u.password === currentPassword || updatedInFirebase) {
          u.password = newPassword;
          u.updatedAt = new Date().toISOString();
          passwordMatched = true;
        }
      }
    });

    if (!updatedInFirebase && (!localFound || !passwordMatched)) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'Current password is incorrect or account not found.',
          hi: 'वर्तमान पासवर्ड गलत है या खाता नहीं मिला।',
          ml: 'നിലവിലെ പാസ്‌വേഡ് തെറ്റാണ് അല്ലെങ്കിൽ അക്കൗണ്ട് കണ്ടെത്താനായില്ല.'
        }
      };
    }

    safeSetJSON(STORAGE_KEYS.PARTICIPANTS, localUsers);
    emitSync(STORAGE_KEYS.PARTICIPANTS, { action: 'password-changed', username: identifier });

    appendSecurityLog({
      type: 'INTERCESSOR_PASSWORD_CHANGED',
      actor: identifier,
      detail: 'Participant password updated on Firebase Cloud'
    });

    return {
      ok: true,
      messageTrilingual: {
        en: 'Password updated online successfully in Firebase Cloud!',
        hi: 'पासवर्ड ऑनलाइन सफलतापूर्वक बदल दिया गया है!',
        ml: 'പാസ്‌വേഡ് ഓൺലൈനായി വിജയകരമായി മാറ്റി!'
      }
    };
  }

  function logoutParticipant() {
    setParticipantSession(null);
  }

  // Admin Portal (admin.html): Auth, Brute-Force Protection & Online Password Change
  function getLocalAdminAuth() {
    const stored = safeGetJSON(STORAGE_KEYS.ADMIN_AUTH, null);
    if (!stored || !stored.username || !stored.password) {
      const def = {
        username: DEFAULT_ADMIN_USER,
        password: DEFAULT_ADMIN_PASS,
        updatedAt: new Date().toISOString()
      };
      safeSetJSON(STORAGE_KEYS.ADMIN_AUTH, def);
      return def;
    }
    return stored;
  }

  function getAdminLockoutState() {
    const raw = safeGetJSON(STORAGE_KEYS.ADMIN_LOCKOUT, {
      failedAttempts: 0,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: null
    });
    const now = Date.now();
    const lockedUntilMs = raw.lockedUntil ? new Date(raw.lockedUntil).getTime() : 0;
    if (lockedUntilMs > 0 && lockedUntilMs <= now) {
      const resetState = {
        failedAttempts: 0,
        maxAttempts: MAX_FAILED_ATTEMPTS,
        lockedUntil: null,
        locked: false,
        remainingSeconds: 0,
        attemptsRemaining: MAX_FAILED_ATTEMPTS
      };
      safeSetJSON(STORAGE_KEYS.ADMIN_LOCKOUT, resetState);
      return resetState;
    }
    const isLocked = lockedUntilMs > now;
    const remainingSeconds = isLocked ? Math.ceil((lockedUntilMs - now) / 1000) : 0;
    const failed = Number(raw.failedAttempts) || 0;
    return {
      failedAttempts: failed,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: isLocked ? raw.lockedUntil : null,
      locked: isLocked,
      remainingSeconds: remainingSeconds,
      attemptsRemaining: isLocked ? 0 : Math.max(0, MAX_FAILED_ATTEMPTS - failed)
    };
  }

  function appendSecurityLog(eventObj) {
    const logId = 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const entry = Object.assign(
      {
        id: logId,
        timestamp: new Date().toISOString()
      },
      eventObj
    );
    const log = safeGetJSON(STORAGE_KEYS.SECURITY_LOG, []);
    log.unshift(entry);
    safeSetJSON(STORAGE_KEYS.SECURITY_LOG, log.slice(0, 50));
    emitSync(STORAGE_KEYS.SECURITY_LOG, {});

    // Sync to Firebase
    fbPut('/security_log/' + logId, entry);
  }

  async function fetchSecurityLog() {
    try {
      const fbData = await fbGet('/security_log');
      if (fbData && typeof fbData === 'object') {
        const list = Array.isArray(fbData) ? fbData.filter(Boolean) : Object.values(fbData).filter(Boolean);
        list.sort(function (a, b) {
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });
        safeSetJSON(STORAGE_KEYS.SECURITY_LOG, list.slice(0, 50));
        return list;
      }
    } catch (e) {}
    return getSecurityLog();
  }

  function getSecurityLog() {
    return safeGetJSON(STORAGE_KEYS.SECURITY_LOG, []);
  }

  function getAdminSession() {
    return safeGetJSON(STORAGE_KEYS.ADMIN_SESSION, null);
  }

  function setAdminSession(sessionObj) {
    if (!sessionObj) {
      try {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      } catch (e) {}
    } else {
      safeSetJSON(STORAGE_KEYS.ADMIN_SESSION, sessionObj);
    }
    emitSync(STORAGE_KEYS.ADMIN_SESSION, { session: sessionObj });
  }

  async function loginAdmin(usernameInput, passwordInput) {
    const username = String(usernameInput || '').trim();
    const password = String(passwordInput || '');

    // Check client lockout state first
    const lockState = getAdminLockoutState();
    if (lockState.locked) {
      return {
        ok: false,
        locked: true,
        failedAttempts: lockState.failedAttempts,
        maxAttempts: MAX_FAILED_ATTEMPTS,
        attemptsRemaining: 0,
        lockedUntil: lockState.lockedUntil,
        remainingSeconds: lockState.remainingSeconds,
        errorTrilingual: {
          en: 'Account temporarily locked due to multiple failed login attempts. Try again in ' + lockState.remainingSeconds + 's.',
          hi: 'कई बार गलत लॉगिन प्रयासों के कारण खाता अस्थायी रूप से लॉक कर दिया गया है। कृपया ' + lockState.remainingSeconds + ' सेकंड बाद पुनः प्रयास करें।',
          ml: 'തുടർച്ചയായ തെറ്റായ ലോഗിൻ ശ്രമങ്ങൾ കാരണം അക്കൗണ്ട് താൽക്കാലികമായി ലോക്ക് ചെയ്തിരിക്കുന്നു. ' + lockState.remainingSeconds + ' സെക്കൻഡിനു ശേഷം ശ്രമിക്കുക.'
        }
      };
    }

    // 1. Try Firebase Admin credentials
    let adminData = null;
    try {
      adminData = await fbGet('/admin');
    } catch (e) {}

    const targetUser = (adminData && adminData.username) || DEFAULT_ADMIN_USER;
    const targetPass = (adminData && adminData.password) || DEFAULT_ADMIN_PASS;

    const isMatch = (username.toLowerCase() === targetUser.toLowerCase()) && (password === targetPass);

    if (isMatch) {
      // Reset lockout counters
      const cleanLock = {
        failedAttempts: 0,
        maxAttempts: MAX_FAILED_ATTEMPTS,
        lockedUntil: null
      };
      safeSetJSON(STORAGE_KEYS.ADMIN_LOCKOUT, cleanLock);
      emitSync(STORAGE_KEYS.ADMIN_LOCKOUT, cleanLock);
      fbPatch('/admin/lockout', { failedAttempts: 0, locked: false });

      const localAdmin = getLocalAdminAuth();
      localAdmin.username = targetUser;
      localAdmin.password = targetPass;
      safeSetJSON(STORAGE_KEYS.ADMIN_AUTH, localAdmin);

      const session = {
        username: targetUser,
        loginAt: new Date().toISOString(),
        token: 'adm_fb_' + Date.now()
      };
      setAdminSession(session);
      appendSecurityLog({
        type: 'ADMIN_LOGIN_SUCCESS',
        actor: username,
        detail: 'Admin signed in successfully via Firebase Cloud'
      });

      return {
        ok: true,
        admin: session
      };
    }

    // Failed attempt: increment brute-force counter
    const nextFailed = lockState.failedAttempts + 1;
    const shouldLock = nextFailed >= MAX_FAILED_ATTEMPTS;
    const lockedUntilIso = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : null;
    const nextLockState = {
      failedAttempts: nextFailed,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: lockedUntilIso
    };
    safeSetJSON(STORAGE_KEYS.ADMIN_LOCKOUT, nextLockState);
    emitSync(STORAGE_KEYS.ADMIN_LOCKOUT, nextLockState);

    fbPatch('/admin/lockout', { failedAttempts: nextFailed, locked: shouldLock });

    const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - nextFailed);
    const remainingSeconds = shouldLock ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0;

    appendSecurityLog({
      type: shouldLock ? 'ADMIN_LOCKOUT' : 'ADMIN_LOGIN_FAILED',
      actor: username || 'unknown',
      detail: shouldLock
        ? 'Admin account locked for 5 minutes after ' + nextFailed + ' failed attempts'
        : 'Admin failed login attempt (' + nextFailed + '/' + MAX_FAILED_ATTEMPTS + ')'
    });

    return {
      ok: false,
      locked: shouldLock,
      failedAttempts: nextFailed,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      attemptsRemaining: attemptsRemaining,
      lockedUntil: lockedUntilIso,
      remainingSeconds: remainingSeconds,
      errorTrilingual: shouldLock
        ? {
            en: 'Maximum failed attempts (' + MAX_FAILED_ATTEMPTS + ') reached. Admin portal locked for 5 minutes.',
            hi: 'अधिकतम गलत प्रयास (' + MAX_FAILED_ATTEMPTS + ') पूरे हुए। एडमिन पोर्टल 5 मिनट के लिए लॉक कर दिया गया है।',
            ml: 'പരമാവധി തെറ്റായ ശ്രമങ്ങൾ (' + MAX_FAILED_ATTEMPTS + ') പൂർത്തിയായി. അഡ്മിൻ പോർട്ടൽ 5 മിനിറ്റ് നേരത്തേക്ക് ലോക്ക് ചെയ്തിരിക്കുന്നു.'
          }
        : {
            en: 'Invalid admin credentials. ' + attemptsRemaining + ' attempt(s) remaining before lockout.',
            hi: 'अमान्य एडमिन क्रेडेंशियल। लॉकआउट से पहले ' + attemptsRemaining + ' प्रयास शेष हैं।',
            ml: 'തെറ്റായ അഡ്മിൻ വിവരങ്ങൾ. ലോക്ക് ആകുന്നതിന് മുമ്പ് ' + attemptsRemaining + ' ശ്രമം ബാക്കിയുണ്ട്.'
          }
    };
  }

  async function changeAdminPassword(currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'Please enter both current password and new password.',
          hi: 'कृपया वर्तमान पासवर्ड और नया पासवर्ड दोनों दर्ज करें।',
          ml: 'നിലവിലെ പാസ്‌വേഡും പുതിയ പാസ്‌വേഡും നൽകുക.'
        }
      };
    }

    if (String(newPassword).length < 6) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'New admin password must be at least 6 characters.',
          hi: 'नया एडमिन पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।',
          ml: 'പുതിയ അഡ്മിൻ പാസ്‌വേഡ് കുറഞ്ഞത് 6 അക്ഷരമെങ്കിലും ഉണ്ടായിരിക്കണം.'
        }
      };
    }

    // 1. Check against Firebase /admin
    let adminData = null;
    try {
      adminData = await fbGet('/admin');
    } catch (e) {}

    const targetPass = (adminData && adminData.password) || DEFAULT_ADMIN_PASS;
    if (currentPassword !== targetPass) {
      return {
        ok: false,
        errorTrilingual: {
          en: 'Current admin password is incorrect.',
          hi: 'वर्तमान एडमिन पासवर्ड गलत है।',
          ml: 'നിലവിലെ അഡ്മിൻ പാസ്‌വേഡ് തെറ്റാണ്.'
        }
      };
    }

    // 2. Update Firebase
    const nowIso = new Date().toISOString();
    await fbPatch('/admin', {
      password: newPassword,
      updatedAt: nowIso
    });

    const localAdmin = getLocalAdminAuth();
    localAdmin.password = newPassword;
    localAdmin.updatedAt = nowIso;
    safeSetJSON(STORAGE_KEYS.ADMIN_AUTH, localAdmin);

    appendSecurityLog({
      type: 'ADMIN_PASSWORD_CHANGED',
      actor: localAdmin.username || 'admin',
      detail: 'Admin password updated in Firebase Cloud'
    });

    return {
      ok: true,
      messageTrilingual: {
        en: 'Admin password updated successfully in Firebase Cloud!',
        hi: 'एडमिन पासवर्ड फायरबेस क्लाउड में सफलतापूर्वक अपडेट कर दिया गया है!',
        ml: 'അഡ്മിൻ പാസ്‌വേഡ് ഫയർബേസ് ക്ലൗഡിൽ വിജയകരമായി പുതുക്കി!'
      }
    };
  }

  function logoutAdmin() {
    const s = getAdminSession();
    if (s) {
      appendSecurityLog({
        type: 'ADMIN_LOGOUT',
        actor: s.username || 'admin',
        detail: 'Admin signed out'
      });
    }
    setAdminSession(null);
  }

  function onSync(callback) {
    if (typeof callback === 'function') {
      syncListeners.push(callback);
    }
  }

  window.PrayerSync = {
    FIREBASE_URL: FIREBASE_BASE_URL,
    getFirebaseStatus: function () {
      return {
        connected: firebaseConnected,
        databaseURL: FIREBASE_BASE_URL,
        projectId: 'adonaibroadcast-11095'
      };
    },
    STORAGE_KEYS: STORAGE_KEYS,
    CATEGORIES: CATEGORIES,
    STATES_LIST: STATES_LIST,
    DEFAULT_REQUESTS: DEFAULT_REQUESTS,
    getLang: getLang,
    setLang: setLang,
    getPrayedDays: getPrayedDays,
    getPrayedPoints: getPrayedPoints,
    saveProgress: saveProgress,
    getPrayerRequests: getPrayerRequests,
    fetchPrayerRequests: fetchPrayerRequests,
    submitPrayerRequest: submitPrayerRequest,
    prayForRequest: prayForRequest,
    hasPrayedForRequest: hasPrayedForRequest,
    updatePrayerRequest: updatePrayerRequest,
    deletePrayerRequest: deletePrayerRequest,
    getLocalParticipants: getLocalParticipants,
    fetchParticipants: fetchParticipants,
    getParticipantSession: getParticipantSession,
    registerParticipant: registerParticipant,
    loginParticipant: loginParticipant,
    changeParticipantPassword: changeParticipantPassword,
    logoutParticipant: logoutParticipant,
    getAdminLockoutState: getAdminLockoutState,
    getAdminSession: getAdminSession,
    loginAdmin: loginAdmin,
    changeAdminPassword: changeAdminPassword,
    logoutAdmin: logoutAdmin,
    getSecurityLog: getSecurityLog,
    fetchSecurityLog: fetchSecurityLog,
    onSync: onSync,
    emitSync: emitSync
  };
})(window);
