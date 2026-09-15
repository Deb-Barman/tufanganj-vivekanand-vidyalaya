(function(){
  "use strict";

  /* Defensive polyfill: guarantees NodeList.forEach exists even on very
     old WebKit engines, so one missing method can never halt the whole
     script and take unrelated sections (like the teacher directory) down
     with it. No-op on every modern browser. */
  if(window.NodeList && !NodeList.prototype.forEach){
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  /* Runs each feature module in isolation: if one module throws (an
     unsupported API on an old browser, a missing element, etc.) the
     error is logged and every other module still initializes normally.
     This is what keeps, say, a login-form typo from being able to take
     the teacher directory or the theme switcher down with it. */
  function safeInit(label, fn){
    try{ fn(); }
    catch(err){
      if(window.console && console.warn){ console.warn('[TVV] ' + label + ' failed to init:', err); }
    }
  }

  /* ============================================================
     SPLASH
     ============================================================ */
  safeInit('splash', function(){
    var splash = document.getElementById('splash');
    if(!splash) return;
    window.addEventListener('load', function(){
      setTimeout(function(){ splash.classList.add('hide'); }, 1300);
    });
    setTimeout(function(){ splash.classList.add('hide'); }, 3000);
  });

  /* ============================================================
     THEME SYSTEM — dark / light / system
     ============================================================ */
  safeInit('theme system', function(){
  var root = document.documentElement;
  var THEME_KEY = 'tvv-theme-pref';
  var themeToggle = document.getElementById('themeToggle');
  var themeMenu = document.getElementById('themeMenu');
  var themeIcon = document.getElementById('themeIcon');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  var ICONS = {
    dark: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
    light: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>',
    system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'
  };

  function resolveTheme(pref){
    if(pref === 'system'){
      return (mq && mq.matches) ? 'dark' : 'light';
    }
    return pref;
  }

  function applyTheme(pref){
    var resolved = resolveTheme(pref);
    root.setAttribute('data-theme', resolved);
    themeIcon.innerHTML = ICONS[pref] || ICONS.dark;
    document.querySelectorAll('#themeMenu button').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-theme-choice') === pref);
    });
    try{ localStorage.setItem(THEME_KEY, pref); }catch(e){}
  }

  var savedPref = 'dark';
  try{ savedPref = localStorage.getItem(THEME_KEY) || 'dark'; }catch(e){}
  applyTheme(savedPref);

  if(mq){
    mq.addEventListener ? mq.addEventListener('change', function(){
      var current = 'dark';
      try{ current = localStorage.getItem(THEME_KEY) || 'dark'; }catch(e){}
      if(current === 'system') applyTheme('system');
    }) : null;
  }

  themeToggle.addEventListener('click', function(e){
    e.stopPropagation();
    var isOpen = themeMenu.classList.toggle('open');
    themeToggle.setAttribute('aria-expanded', String(isOpen));
  });
  document.querySelectorAll('#themeMenu button').forEach(function(btn){
    btn.addEventListener('click', function(){
      applyTheme(btn.getAttribute('data-theme-choice'));
      themeMenu.classList.remove('open');
      themeToggle.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', function(e){
    if(!themeMenu.contains(e.target) && e.target !== themeToggle){
      themeMenu.classList.remove('open');
      themeToggle.setAttribute('aria-expanded', 'false');
    }
  });
  }); // end theme system

  /* ============================================================
     MOBILE MENU
     ============================================================ */
  safeInit('mobile menu', function(){
  var burger = document.getElementById('burgerBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  function closeMobileMenu(){
    mobileMenu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  burger.addEventListener('click', function(){
    var isOpen = mobileMenu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', closeMobileMenu);
  });
  }); // end mobile menu

  /* ============================================================
     SCROLL PROGRESS + ACTIVE NAV
     ============================================================ */
  safeInit('scroll progress + active nav', function(){
  var scrollProgress = document.getElementById('scrollProgress');
  function updateScrollProgress(){
    var h = document.documentElement;
    var scrolled = h.scrollTop;
    var height = h.scrollHeight - h.clientHeight;
    var pct = height > 0 ? (scrolled / height) * 100 : 0;
    scrollProgress.style.width = pct + '%';
  }
  var navLinks = document.querySelectorAll('nav.primary a[href^="#"]');
  var sectionIds = Array.prototype.map.call(navLinks, function(a){ return a.getAttribute('href').slice(1); })
    .filter(function(id){ return document.getElementById(id); });
  function updateActiveNav(){
    var scrollPos = window.scrollY + 120;
    var currentId = null;
    sectionIds.forEach(function(id){
      var el = document.getElementById(id);
      if(el && el.offsetTop <= scrollPos){ currentId = id; }
    });
    navLinks.forEach(function(a){
      a.classList.toggle('nav-active', a.getAttribute('href') === '#' + currentId);
    });
  }
  var ticking = false;
  function onScroll(){
    if(!ticking){
      requestAnimationFrame(function(){ updateScrollProgress(); updateActiveNav(); ticking = false; });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  updateScrollProgress(); updateActiveNav();
  }); // end scroll progress + active nav

  /* ============================================================
     REVEAL ON SCROLL
     ============================================================ */
  safeInit('reveal on scroll', function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  if('IntersectionObserver' in window && !reduceMotion){
    var revealObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold:.12, rootMargin:'0px 0px -60px 0px' });
    revealEls.forEach(function(el){ revealObserver.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in-view'); });
  }
  }); // end reveal on scroll

  /* ============================================================
     TEACHERS DIRECTORY
     ============================================================ */
  safeInit('teachers directory', function(){
  var TEACHERS = [
    { name:"Amit Sharma", role:"Senior Science Teacher", dept:"Science", subjects:["Physics","Chemistry"], exp:"12 yrs", bio:"Passionate about making science accessible and exciting for students, with a strong focus on lab-based, hands-on learning." },
    { name:"Sabyasachi Mukherjee", role:"Principal", dept:"Administration", subjects:["Administration","Ethics"], exp:"18 yrs", bio:"Dedicated to fostering an environment of academic excellence and holistic development at Tufanganj Vivekananda Vidyalaya." },
    { name:"Rina Chatterjee", role:"Head of Mathematics", dept:"Science", subjects:["Mathematics"], exp:"15 yrs", bio:"Believes every student can be good at mathematics with the right explanation and enough patient practice." },
    { name:"Subrata Roy", role:"Biology Teacher", dept:"Science", subjects:["Biology"], exp:"9 yrs", bio:"Runs the school's biology practicals and mentors students preparing for medical entrance examinations." },
    { name:"Mousumi Dey", role:"Computer Science Teacher", dept:"Science", subjects:["Computer Science"], exp:"7 yrs", bio:"Introduces students to programming fundamentals and manages the school's computer centre." },
    { name:"Pradip Barman", role:"Head of History", dept:"Arts", subjects:["History"], exp:"20 yrs", bio:"One of the school's longest-serving teachers, known for making historical events feel immediate and alive." },
    { name:"Anjali Sen", role:"Geography Teacher", dept:"Arts", subjects:["Geography"], exp:"11 yrs", bio:"Combines classroom teaching with field observation, using the school grounds itself as a teaching aid." },
    { name:"Debasish Ghosh", role:"Philosophy Teacher", dept:"Arts", subjects:["Philosophy"], exp:"14 yrs", bio:"Encourages students to question, argue and reason carefully — skills he considers the real goal of schooling." },
    { name:"Swapna Biswas", role:"Political Science Teacher", dept:"Arts", subjects:["Political Science"], exp:"10 yrs", bio:"Connects classroom civics to real institutions, helping students understand how governance actually works." },
    { name:"Tapan Das", role:"Sanskrit Teacher", dept:"Languages", subjects:["Sanskrit"], exp:"22 yrs", bio:"A classical scholar who has taught Sanskrit at TVV since the school's earlier years." },
    { name:"Sabita Roy", role:"Bangla Teacher", dept:"Languages", subjects:["Bangla"], exp:"13 yrs", bio:"Believes strong Bangla literacy underpins learning in every other subject, and teaches accordingly." },
    { name:"Kajal Sarkar", role:"English Teacher", dept:"Languages", subjects:["English"], exp:"8 yrs", bio:"Focuses on both grammar fundamentals and confident spoken English for board and beyond." },
    { name:"Bikash Saha", role:"Physics Teacher", dept:"Science", subjects:["Physics"], exp:"16 yrs", bio:"Runs the Physics laboratory and coaches students for state-level science exhibitions." },
    { name:"Nilima Adhikari", role:"Chemistry Teacher", dept:"Science", subjects:["Chemistry"], exp:"10 yrs", bio:"Known for clear, safety-first laboratory demonstrations that make abstract reactions concrete." },
    { name:"Ranjit Mondal", role:"Physical Education Instructor", dept:"Sports", subjects:["Physical Education"], exp:"19 yrs", bio:"Runs daily drills and coaches the school's football and cricket teams for the annual tournament." },
    { name:"Suman Chakraborty", role:"Assistant Sports Instructor", dept:"Sports", subjects:["Physical Education"], exp:"6 yrs", bio:"Organises the Annual Sports Day and after-class athletics sessions across all classes." },
    { name:"Manisha Pal", role:"Art & Craft Teacher", dept:"Arts", subjects:["Art & Craft"], exp:"5 yrs", bio:"Leads creative projects for the lower classes and coordinates the school's cultural programme displays." },
    { name:"Ashok Kar", role:"Mathematics Teacher", dept:"Science", subjects:["Mathematics"], exp:"9 yrs", bio:"Teaches lower and middle secondary mathematics, focused on building strong fundamentals early." },
    { name:"Ipsita Bhattacharjee", role:"Biology Teacher", dept:"Science", subjects:["Biology"], exp:"7 yrs", bio:"Supervises the biology lab and the school's small botanical corner used for practicals." },
    { name:"Goutam Barman", role:"History Teacher", dept:"Arts", subjects:["History"], exp:"12 yrs", bio:"Teaches middle and higher secondary history with an emphasis on regional and local history of Cooch Behar." },
    { name:"Papiya Nandi", role:"English Teacher", dept:"Languages", subjects:["English"], exp:"11 yrs", bio:"Coordinates the school debate and elocution activities alongside her regular English classes." },
    { name:"Sanjoy Dutta", role:"Geography Teacher", dept:"Arts", subjects:["Geography"], exp:"8 yrs", bio:"Uses maps and regional data to connect classroom geography to real conditions around Cooch Behar." },
    { name:"Chandana Das", role:"Bangla Teacher", dept:"Languages", subjects:["Bangla"], exp:"17 yrs", bio:"A senior Bangla literature teacher who also mentors the school magazine's student editors." },
    { name:"Arindam Ghosh", role:"Mathematics Teacher", dept:"Science", subjects:["Mathematics"], exp:"6 yrs", bio:"Focuses on problem-solving practice for students preparing for board and competitive examinations." },
    { name:"Lipika Sarkar", role:"Music & Cultural Coordinator", dept:"Arts", subjects:["Music"], exp:"9 yrs", bio:"Trains students for the school's annual cultural programme and inter-school music events." },
    { name:"Prasenjit Roy", role:"Computer Science Teacher", dept:"Science", subjects:["Computer Science"], exp:"5 yrs", bio:"Teaches introductory computing and helps maintain the school's digital infrastructure and this Smart Portal." },
    { name:"Moumita Ghosh", role:"Philosophy & Ethics Teacher", dept:"Arts", subjects:["Philosophy"], exp:"7 yrs", bio:"Leads discussion-based classes that connect classical philosophy to everyday student life." },
    { name:"Biplab Karmakar", role:"Physical Education Instructor", dept:"Sports", subjects:["Physical Education"], exp:"10 yrs", bio:"Coaches the school cricket team and assists with ground maintenance and sports equipment." },
    { name:"Sunanda Roy Chowdhury", role:"Chemistry Teacher", dept:"Science", subjects:["Chemistry"], exp:"14 yrs", bio:"Heads the Chemistry lab's practical examinations and mentors new lab assistants." },
    { name:"Kaushik Sen", role:"Political Science Teacher", dept:"Arts", subjects:["Political Science"], exp:"6 yrs", bio:"Runs mock-parliament sessions to make civics tangible for higher secondary students." }
  ];

  var teacherGrid = document.getElementById('teacherGrid');
  var teacherEmpty = document.getElementById('teacherEmpty');
  var deptFiltersEl = document.getElementById('deptFilters');
  var searchInput = document.getElementById('teacherSearch');
  var activeDept = 'All';

  function initials(name){
    return name.split(' ').map(function(p){ return p[0]; }).slice(0,2).join('').toUpperCase();
  }

  function renderTeachers(){
    var q = (searchInput.value || '').trim().toLowerCase();
    var filtered = TEACHERS.filter(function(t){
      var matchesDept = activeDept === 'All' || t.dept === activeDept;
      var matchesQuery = !q || t.name.toLowerCase().indexOf(q) > -1 ||
        t.subjects.join(' ').toLowerCase().indexOf(q) > -1 || t.role.toLowerCase().indexOf(q) > -1;
      return matchesDept && matchesQuery;
    });
    teacherEmpty.style.display = filtered.length ? 'none' : 'block';
    teacherGrid.innerHTML = filtered.map(function(t, i){
      return '<button type="button" class="teacher-card" data-idx="' + TEACHERS.indexOf(t) + '">' +
        '<div class="t-top"><div class="t-avatar">' + initials(t.name) + '</div>' +
        '<div><div class="t-name">' + t.name + '</div><div class="t-role">' + t.role + '</div></div></div>' +
        '<div class="t-meta"><span>' + t.dept + '</span><span>' + t.exp + '</span></div>' +
        '</button>';
    }).join('');
    teacherGrid.querySelectorAll('.teacher-card').forEach(function(card){
      card.addEventListener('click', function(){ openTeacherModal(TEACHERS[parseInt(card.getAttribute('data-idx'), 10)]); });
    });
  }

  var depts = ['All'].concat(Array.from(new Set(TEACHERS.map(function(t){ return t.dept; }))).sort());
  deptFiltersEl.innerHTML = depts.map(function(d){
    return '<button type="button" class="filter-chip' + (d === 'All' ? ' active' : '') + '" data-dept="' + d + '">' + d + '</button>';
  }).join('');
  deptFiltersEl.querySelectorAll('.filter-chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      activeDept = chip.getAttribute('data-dept');
      deptFiltersEl.querySelectorAll('.filter-chip').forEach(function(c){ c.classList.toggle('active', c === chip); });
      renderTeachers();
    });
  });
  searchInput.addEventListener('input', renderTeachers);
  renderTeachers();

  var teacherModalVeil = document.getElementById('teacherModalVeil');
  var modalClose = document.getElementById('modalClose');
  function openTeacherModal(t){
    document.getElementById('modalAvatar').textContent = initials(t.name);
    document.getElementById('modalName').textContent = t.name;
    document.getElementById('modalTitle').textContent = t.role;
    document.getElementById('modalBio').textContent = t.bio;
    document.getElementById('modalSubjects').textContent = t.subjects.join(', ');
    document.getElementById('modalExp').textContent = t.exp;
    document.getElementById('modalDept').textContent = t.dept;
    teacherModalVeil.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeTeacherModal(){
    teacherModalVeil.classList.remove('open');
    document.body.style.overflow = '';
  }
  modalClose.addEventListener('click', closeTeacherModal);
  teacherModalVeil.addEventListener('click', function(e){ if(e.target === teacherModalVeil) closeTeacherModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeTeacherModal(); });
  }); // end teachers directory

  /* ============================================================
     GALLERY
     ============================================================ */
  safeInit('gallery', function(){
  var galleryGrid = document.getElementById('galleryGrid');
  var GALLERY = [
    { cap:"Morning assembly", bg:"rgba(210,201,244,.1)", fg:"var(--accent)" },
    { cap:"Chemistry laboratory", bg:"rgba(154,219,194,.1)", fg:"#9adbc2" },
    { cap:"Football on the main field", bg:"rgba(229,186,144,.1)", fg:"#e5ba90" },
    { cap:"Results day", bg:"rgba(210,201,244,.1)", fg:"var(--accent)" }
  ];
  galleryGrid.innerHTML = GALLERY.map(function(g, i){
    return '<figure class="gallery-item">' +
      '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="300" height="220" fill="' + g.bg + '"/>' +
        '<circle cx="' + (60 + i * 20) + '" cy="60" r="34" fill="' + g.fg + '" opacity="0.6"/>' +
        '<rect x="0" y="150" width="300" height="70" fill="' + g.fg + '" opacity="0.15"/>' +
        '<path d="M0 150 Q75 120 150 150 T300 150" stroke="' + g.fg + '" stroke-width="2" fill="none" opacity="0.5"/>' +
      '</svg>' +
      '<figcaption class="gallery-cap">' + g.cap + '</figcaption>' +
    '</figure>';
  }).join('');
  }); // end gallery

  /* ============================================================
     FAQ ACCORDION
     ============================================================ */
  safeInit('faq accordion', function(){
  var faqList = document.getElementById('faqList');
  if(faqList){
    faqList.querySelectorAll('.faq-item').forEach(function(item){
      var btn = item.querySelector('.faq-q');
      btn.addEventListener('click', function(){
        var isOpen = item.classList.contains('open');
        faqList.querySelectorAll('.faq-item.open').forEach(function(openItem){
          if(openItem !== item){
            openItem.classList.remove('open');
            openItem.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
          }
        });
        item.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }
  }); // end faq accordion

  /* ============================================================
     SHARED STORAGE HELPERS
     Used by both the Notice Board demo and the Portal Dashboard
     below, so they live outside any single safeInit module.
     ============================================================ */
  var LS_PREFIX = 'tvv_';
  function lsGet(key, fallback){
    try{
      var raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function lsSet(key, value){
    try{ localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); }catch(e){}
  }
  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ============================================================
     NOTICE BOARD (localStorage-backed demo)
     ============================================================ */
  safeInit('notice board', function(){
  var noticeForm = document.getElementById('noticeForm');
  var noticeList = document.getElementById('noticeList');
  var noticeCount = document.getElementById('noticeCount');
  var notices = lsGet('notices', []);

  function renderNotices(){
    noticeCount.textContent = notices.length + ' posted';
    if(!notices.length){
      noticeList.innerHTML = '<p class="nb-empty">No notices posted yet — try the form to add one.</p>';
      return;
    }
    noticeList.innerHTML = notices.slice().reverse().map(function(n){
      return '<div class="nb-item"><h5>' + escapeHtml(n.title) + '</h5><p>' + escapeHtml(n.body) + '</p>' +
        '<div class="nb-meta"><span>' + (n.cls ? escapeHtml(n.cls) : 'All classes') + '</span><span>' + n.date + '</span></div></div>';
    }).join('');
  }
  renderNotices();

  if(noticeForm){
    noticeForm.addEventListener('submit', function(e){
      e.preventDefault();
      var title = document.getElementById('nTitle').value.trim();
      var cls = document.getElementById('nClass').value.trim();
      var body = document.getElementById('nBody').value.trim();
      if(!title || !body) return;
      notices.push({ title:title, cls:cls, body:body, date: new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) });
      lsSet('notices', notices);
      renderNotices();
      noticeForm.reset();
    });
  }
  }); // end notice board

  /* ============================================================
     PORTAL LOGIN + DASHBOARD
     ============================================================ */
  safeInit('portal dashboard', function(){
  var DEMO_ACCOUNTS = {
    admin:   { password:'admin123',   role:'Admin',   name:'Admin User' },
    teacher: { password:'teacher123', role:'Teacher', name:'Demo Teacher' },
    student: { password:'student123', role:'Student', name:'Demo Student' }
  };

  var loginGate = document.getElementById('loginGate');
  var dashboard = document.getElementById('dashboard');
  var loginForm = document.getElementById('loginForm');
  var loginError = document.getElementById('loginError');
  var dashRoleBadge = document.getElementById('dashRoleBadge');
  var dashWelcome = document.getElementById('dashWelcome');
  var resetDemoBtn = document.getElementById('resetDemoBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var navPortalBtn = document.getElementById('navPortalBtn');

  var currentSession = lsGet('session', null);

  function isStaff(){
    return currentSession && (currentSession.role === 'Admin' || currentSession.role === 'Teacher');
  }

  function showDashboard(){
    loginGate.style.display = 'none';
    dashboard.style.display = 'flex';
    var roleClass = currentSession.role.toLowerCase();
    dashRoleBadge.textContent = currentSession.role;
    dashRoleBadge.className = 'dc-role ' + roleClass;
    dashWelcome.textContent = 'Welcome back, ' + currentSession.name;
    resetDemoBtn.style.display = currentSession.role === 'Admin' ? 'inline-flex' : 'none';
    document.getElementById('resultsAdminForm').style.display = isStaff() ? 'block' : 'none';
    document.getElementById('attendanceAdminForm').style.display = isStaff() ? 'block' : 'none';
    document.getElementById('studentsAdminForm').style.display = isStaff() ? 'block' : 'none';
    document.getElementById('feesAdminForm').style.display = currentSession.role === 'Admin' ? 'block' : 'none';
    navPortalBtn.textContent = 'Go to Dashboard';
    renderOverview();
    renderResults(); renderAttendance(); renderStudents(); renderFees();
  }
  function showLoginGate(){
    loginGate.style.display = 'flex';
    dashboard.style.display = 'none';
    navPortalBtn.textContent = 'Student & Staff Login';
  }
  if(currentSession){ showDashboard(); } else { showLoginGate(); }

  if(loginForm){
    loginForm.addEventListener('submit', function(e){
      e.preventDefault();
      var user = document.getElementById('loginUser').value.trim().toLowerCase();
      var pass = document.getElementById('loginPass').value;
      var acc = DEMO_ACCOUNTS[user];
      if(acc && acc.password === pass){
        currentSession = { user:user, role:acc.role, name:acc.name };
        lsSet('session', currentSession);
        loginError.style.display = 'none';
        showDashboard();
      } else {
        loginError.style.display = 'block';
      }
    });
  }
  document.querySelectorAll('.demo-cred-row').forEach(function(row){
    row.addEventListener('click', function(){
      document.getElementById('loginUser').value = row.getAttribute('data-user');
      document.getElementById('loginPass').value = row.getAttribute('data-pass');
    });
  });
  if(logoutBtn){
    logoutBtn.addEventListener('click', function(){
      currentSession = null;
      try{ localStorage.removeItem(LS_PREFIX + 'session'); }catch(e){}
      showLoginGate();
    });
  }
  if(resetDemoBtn){
    resetDemoBtn.addEventListener('click', function(){
      ['results','attendance','students','fees'].forEach(function(k){
        try{ localStorage.removeItem(LS_PREFIX + k); }catch(e){}
      });
      resultsData = []; attendanceData = []; studentsData = []; feesData = [];
      renderOverview(); renderResults(); renderAttendance(); renderStudents(); renderFees();
    });
  }

  /* ---------- Dashboard tabs ---------- */
  var dashTabs = document.querySelectorAll('.dash-tab');
  dashTabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      dashTabs.forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.dash-panel').forEach(function(p){ p.classList.remove('active'); });
      document.getElementById('panel-' + tab.getAttribute('data-tab')).classList.add('active');
    });
  });

  /* ---------- Overview ---------- */
  function renderOverview(){
    var ovGrid = document.getElementById('ovGrid');
    var cards = [
      { n: studentsData.length, l:'Students on record' },
      { n: resultsData.length, l:'Result entries' },
      { n: attendanceData.length, l:'Attendance entries' },
      { n: feesData.filter(function(f){ return f.status === 'Due'; }).length, l:'Fee records due' }
    ];
    ovGrid.innerHTML = cards.map(function(c){
      return '<div class="ov-card"><div class="ov-n">' + c.n + '</div><div class="ov-l">' + c.l + '</div></div>';
    }).join('');
  }

  /* ---------- Results module ---------- */
  var resultsData = lsGet('results', []);
  function renderResults(){
    var tbody = document.getElementById('resultsBody');
    if(!resultsData.length){
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No results recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = resultsData.map(function(r, i){
      var pct = r.full ? Math.round((r.marks / r.full) * 100) : 0;
      return '<tr><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.cls) + '</td><td>' + escapeHtml(r.subject) + '</td>' +
        '<td>' + r.marks + ' / ' + r.full + '</td><td>' + pct + '%</td>' +
        '<td>' + (isStaff() ? '<button class="row-del" data-i="' + i + '" data-t="results" aria-label="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>' : '') + '</td></tr>';
    }).join('');
  }
  var rAddBtn = document.getElementById('rAddBtn');
  if(rAddBtn){
    rAddBtn.addEventListener('click', function(){
      var name = document.getElementById('rName').value.trim();
      var cls = document.getElementById('rClass').value.trim();
      var subject = document.getElementById('rSubject').value.trim();
      var marks = parseFloat(document.getElementById('rMarks').value);
      var full = parseFloat(document.getElementById('rFull').value) || 100;
      if(!name || !cls || !subject || isNaN(marks)) return;
      resultsData.push({ name:name, cls:cls, subject:subject, marks:marks, full:full });
      lsSet('results', resultsData);
      renderResults(); renderOverview();
      ['rName','rClass','rSubject','rMarks'].forEach(function(id){ document.getElementById(id).value = ''; });
    });
  }

  /* ---------- Attendance module ---------- */
  var attendanceData = lsGet('attendance', []);
  function renderAttendance(){
    var tbody = document.getElementById('attendanceBody');
    if(!attendanceData.length){
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No attendance recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = attendanceData.map(function(a, i){
      var tagClass = a.status === 'Present' ? 'good' : 'warn';
      return '<tr><td>' + escapeHtml(a.name) + '</td><td>' + (a.date || '—') + '</td>' +
        '<td><span class="status-tag ' + tagClass + '">' + a.status + '</span></td>' +
        '<td>' + (isStaff() ? '<button class="row-del" data-i="' + i + '" data-t="attendance" aria-label="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>' : '') + '</td></tr>';
    }).join('');
  }
  var aAddBtn = document.getElementById('aAddBtn');
  if(aAddBtn){
    aAddBtn.addEventListener('click', function(){
      var name = document.getElementById('aName').value.trim();
      var date = document.getElementById('aDate').value;
      var status = document.getElementById('aStatus').value;
      if(!name) return;
      attendanceData.push({ name:name, date:date, status:status });
      lsSet('attendance', attendanceData);
      renderAttendance(); renderOverview();
      document.getElementById('aName').value = '';
      document.getElementById('aDate').value = '';
    });
  }

  /* ---------- Students module ---------- */
  var studentsData = lsGet('students', []);
  function renderStudents(){
    var tbody = document.getElementById('studentsBody');
    var q = (document.getElementById('studentSearchInput').value || '').trim().toLowerCase();
    var filtered = studentsData.filter(function(s){
      return !q || s.name.toLowerCase().indexOf(q) > -1 || s.cls.toLowerCase().indexOf(q) > -1;
    });
    if(!filtered.length){
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No students match.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function(s){
      var i = studentsData.indexOf(s);
      return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + escapeHtml(s.cls) + '</td><td>' + escapeHtml(s.roll) + '</td><td>' + escapeHtml(s.contact) + '</td>' +
        '<td>' + (isStaff() ? '<button class="row-del" data-i="' + i + '" data-t="students" aria-label="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>' : '') + '</td></tr>';
    }).join('');
  }
  var sAddBtn = document.getElementById('sAddBtn');
  if(sAddBtn){
    sAddBtn.addEventListener('click', function(){
      var name = document.getElementById('sName').value.trim();
      var cls = document.getElementById('sClass').value.trim();
      var roll = document.getElementById('sRoll').value.trim();
      var contact = document.getElementById('sContact').value.trim();
      if(!name || !cls) return;
      studentsData.push({ name:name, cls:cls, roll:roll, contact:contact });
      lsSet('students', studentsData);
      renderStudents(); renderOverview();
      ['sName','sClass','sRoll','sContact'].forEach(function(id){ document.getElementById(id).value = ''; });
    });
  }
  var studentSearchInput = document.getElementById('studentSearchInput');
  if(studentSearchInput) studentSearchInput.addEventListener('input', renderStudents);

  /* ---------- Fees module ---------- */
  var feesData = lsGet('fees', []);
  function renderFees(){
    var tbody = document.getElementById('feesBody');
    if(!feesData.length){
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No fee records yet.</td></tr>';
      return;
    }
    tbody.innerHTML = feesData.map(function(f, i){
      var tagClass = f.status === 'Paid' ? 'good' : 'warn';
      return '<tr><td>' + escapeHtml(f.name) + '</td><td>' + escapeHtml(f.term) + '</td><td>&#8377;' + f.amount + '</td>' +
        '<td><span class="status-tag ' + tagClass + '">' + f.status + '</span></td>' +
        '<td>' + (currentSession && currentSession.role === 'Admin' ? '<button class="row-del" data-i="' + i + '" data-t="fees" aria-label="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>' : '') + '</td></tr>';
    }).join('');
  }
  var fAddBtn = document.getElementById('fAddBtn');
  if(fAddBtn){
    fAddBtn.addEventListener('click', function(){
      var name = document.getElementById('fName').value.trim();
      var term = document.getElementById('fTerm').value.trim();
      var amount = parseFloat(document.getElementById('fAmount').value) || 0;
      var status = document.getElementById('fStatus').value;
      if(!name || !term) return;
      feesData.push({ name:name, term:term, amount:amount, status:status });
      lsSet('fees', feesData);
      renderFees(); renderOverview();
      ['fName','fTerm','fAmount'].forEach(function(id){ document.getElementById(id).value = ''; });
    });
  }

  /* ---------- Delegated row-delete handler ---------- */
  document.addEventListener('click', function(e){
    var btn = e.target.closest ? e.target.closest('.row-del') : null;
    if(!btn) return;
    var i = parseInt(btn.getAttribute('data-i'), 10);
    var t = btn.getAttribute('data-t');
    if(t === 'results'){ resultsData.splice(i,1); lsSet('results', resultsData); renderResults(); }
    if(t === 'attendance'){ attendanceData.splice(i,1); lsSet('attendance', attendanceData); renderAttendance(); }
    if(t === 'students'){ studentsData.splice(i,1); lsSet('students', studentsData); renderStudents(); }
    if(t === 'fees'){ feesData.splice(i,1); lsSet('fees', feesData); renderFees(); }
    renderOverview();
  });
  }); // end portal dashboard

  /* ============================================================
     FOOTER YEAR
     ============================================================ */
  safeInit('footer year', function(){
  var yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();
  }); // end footer year

})();
