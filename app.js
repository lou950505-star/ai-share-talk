(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs a'));
  var stepLinks = Array.prototype.slice.call(document.querySelectorAll('.stepper a'));
  var curEl = document.getElementById('cur');
  var totalEl = document.getElementById('total');
  var bar = document.getElementById('bar');
  var root = document.documentElement;
  var current = -1;
  var pageOffset = 0; // ?solo 模式下只剩一页，页码要显示原始页码

  function noMotion() { return root.classList.contains('no-motion'); }
  // 系统「减少动态效果」设置变化时实时生效
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-reduced-motion: reduce)');
    var onMq = function () {
      if (mq.matches) root.classList.add('no-motion');
      else if (!/[?&](static|check)\b/.test(location.search)) root.classList.remove('no-motion');
      if (current >= 0) enter(slides[current]);
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  totalEl.textContent = slides.length;

  // 导航链接自动指向每个部分的第一页（增删页面后不用手改）
  tabs.forEach(function (a) {
    var i = slides.findIndex(function (s) { return s.dataset.part === a.dataset.part; });
    if (i >= 0) a.setAttribute('href', '#' + (i + 1));
  });

  // ---------- 入场动画准备 ----------
  // 大标题拆成单字（保留 <em class="hl"> 等嵌套结构）
  function splitChars(el) {
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        // 中文逐字拆；连续的英文 / 数字（如 AI、Q&A）作为一个整体，避免被折行拆开
        (n.textContent.match(/[A-Za-z0-9&×]+|\s+|./g) || []).forEach(function (c) {
          if (/^\s+$/.test(c)) { frag.appendChild(document.createTextNode(' ')); return; }
          var s = document.createElement('span');
          s.className = 'ch';
          s.textContent = c;
          frag.appendChild(s);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        splitChars(n);
      }
    });
  }
  slides.forEach(function (s) {
    s.querySelectorAll('.chars').forEach(function (el) {
      el.setAttribute('aria-label', el.textContent);
      splitChars(el);
      el.querySelectorAll('.ch').forEach(function (c, k) { c.style.setProperty('--d', (0.25 + k * 0.07).toFixed(2) + 's'); });
    });
    // 逐行淡入：按文档顺序依次延迟（stagger）
    var k = 0;
    s.querySelectorAll('.r, .ph, .pop').forEach(function (el) {
      var isMedia = el.classList.contains('ph') || el.classList.contains('pop');
      el.style.setProperty('--d', (0.12 + k * 0.09 + (isMedia ? 0.15 : 0)).toFixed(2) + 's');
      k++;
    });
    // 终端：记下每行原文，打字时逐字恢复
    s.querySelectorAll('.term').forEach(function (t) {
      t._lines = Array.prototype.slice.call(t.querySelectorAll('.tl')).map(function (l) {
        return { el: l, html: l.innerHTML };
      });
    });
  });

  // ---------- 终端打字动画 ----------
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function resetTerm(t) {
    t.classList.remove('is-typing');
    t._lines.forEach(function (l) { l.el.innerHTML = l.html; l.el.classList.remove('pending'); });
    var c = t.querySelector('.cursor');
    if (c) c.remove();
  }
  function cursorEl() { var c = document.createElement('span'); c.className = 'cursor'; return c; }

  function typeTerm(t) {
    resetTerm(t);
    if (noMotion()) { t._lines[t._lines.length - 1].el.appendChild(cursorEl()); return; }
    t.classList.add('is-typing');
    t._lines.forEach(function (l) { l.el.classList.add('pending'); l.el.innerHTML = ''; });
    var at = +(t.dataset.typeStart || 400);
    t._lines.forEach(function (l, i) {
      // 每行：前缀符号（$ / → / ✓）整体出现，后面的文字逐字打出
      var tmp = document.createElement('div');
      tmp.innerHTML = l.html;
      var prefix = tmp.querySelector('.pr, .ok');
      var prefixHtml = prefix ? prefix.outerHTML : '';
      if (prefix) prefix.remove();
      var text = tmp.textContent;
      var speed = i === 0 ? 45 : 32;
      later(function () {
        var c = t.querySelector('.cursor');
        if (c) c.remove();
        l.el.classList.remove('pending');
        l.el.innerHTML = prefixHtml;
        var span = document.createElement('span');
        span.className = 'tx';
        l.el.appendChild(span);
        l.el.appendChild(cursorEl());
      }, at);
      Array.from(text).forEach(function (ch, j) {
        later(function () { l.el.querySelector('.tx').textContent += ch; }, at + 60 + j * speed);
      });
      at += 60 + text.length * speed + (i === 0 ? 420 : 300);
    });
    later(function () { t.classList.remove('is-typing'); }, at);
  }

  // ---------- 测试验收流程动画：安装 → 登录 → 跑 case → 飞书文档，循环播放 ----------
  function resetFlow(f) {
    f.removeAttribute('data-step');
    f.classList.remove('st1', 'st2', 'st3', 'st4');
    f.querySelectorAll('.is-end, .is-run, .is-ok, .is-press').forEach(function (el) { el.classList.remove('is-end', 'is-run', 'is-ok', 'is-press'); });
    f.querySelectorAll('.type').forEach(function (el) { el.textContent = ''; });
    f.querySelectorAll('.flow-steps li').forEach(function (li) { li.classList.remove('is-on', 'is-done'); });
  }
  function flowStep(f, n) {
    f.dataset.step = n;
    for (var k = 1; k <= 4; k++) f.classList.toggle('st' + k, k <= n);
    f.querySelectorAll('.flow-steps li').forEach(function (li, k) {
      li.classList.toggle('is-done', k < n - 1);
      li.classList.toggle('is-on', k === n - 1);
    });
  }
  function playFlow(f) {
    resetFlow(f);
    if (noMotion()) {
      flowStep(f, 4);
      f.querySelectorAll('.fcases li, .dcases li').forEach(function (li) { li.classList.add('is-ok'); });
      return;
    }
    var t = 700;
    later(function () { flowStep(f, 1); }, t);
    later(function () { f.querySelector('.s1').classList.add('is-end'); }, t + 2500);
    t += 3300;
    later(function () { flowStep(f, 2); }, t);
    var at = t + 500;
    f.querySelectorAll('.type').forEach(function (el) {
      Array.from(el.dataset.text).forEach(function (ch, k) {
        later(function () { el.textContent += ch; }, at + k * 70);
      });
      at += el.dataset.text.length * 70 + 300;
    });
    later(function () { f.querySelector('.fbtn').classList.add('is-press'); }, at);
    later(function () { f.querySelector('.fbtn').classList.remove('is-press'); f.querySelector('.s2').classList.add('is-end'); }, at + 250);
    t = at + 1100;
    later(function () { flowStep(f, 3); }, t);
    var docCases = f.querySelectorAll('.dcases li');
    f.querySelectorAll('.fcases li').forEach(function (li, k) {
      later(function () { li.classList.add('is-run'); }, t + 400 + k * 650);
      later(function () { li.classList.remove('is-run'); li.classList.add('is-ok'); if (docCases[k]) docCases[k].classList.add('is-ok'); }, t + 800 + k * 650);
    });
    t += 800 + f.querySelectorAll('.fcases li').length * 650 + 400;
    later(function () { flowStep(f, 4); }, t);
    later(function () { if (f.closest('.slide.is-active')) playFlow(f); }, t + 5500);
  }

  // ---------- 进入 / 离开 ----------
  function enter(slide) {
    clearTimers();
    slide.querySelectorAll('.term').forEach(typeTerm);
    slide.querySelectorAll('.flow').forEach(playFlow);
  }

  var leaveTimer = null;
  function setCurrent(i, fromHash) {
    if (i === current) return;
    var prev = slides[current];
    current = i;
    var s = slides[i];
    if (prev) {
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () {
        slides.forEach(function (x) { if (x !== slides[current]) x.classList.remove('is-leaving'); });
        // 离开的页面复位终端，回来时重播
        prev.querySelectorAll('.term').forEach(resetTerm);
        prev.querySelectorAll('.flow').forEach(resetFlow);
      }, 650);
    }
    s.classList.remove('is-leaving');
    s.scrollTop = 0;
    // 下一帧再加 is-active，保证入场过渡生效
    requestAnimationFrame(function () {
      if (slides[current] === s) s.classList.add('is-active');
    });
    if (noMotion()) s.classList.add('is-active');
    enter(s);

    var part = s.dataset.part;
    var n = i + 1 + pageOffset;
    curEl.textContent = n;
    bar.style.width = (n / (+totalEl.textContent) * 100) + '%';
    document.body.dataset.part = part;
    // 工作流程导航：高亮当前环节，之前的环节标为已完成
    var step = s.dataset.step;
    if (step) document.body.dataset.step = step; else delete document.body.dataset.step;
    stepLinks.forEach(function (a) {
      a.classList.toggle('active', a.dataset.step === step);
      a.classList.toggle('done', !!step && +a.dataset.step < +step);
    });
    tabs.forEach(function (a) { a.classList.toggle('active', a.dataset.part === part); });
    var active = document.querySelector('.tabs a.active');
    if (active && window.innerWidth < 900) {
      active.parentNode.scrollLeft = active.offsetLeft - 16;
    }
    if (!fromHash && !pageOffset) history.replaceState(null, '', '#' + n);
  }

  stepLinks.forEach(function (a) {
    var k = slides.findIndex(function (sl) { return sl.dataset.step === a.dataset.step; });
    if (k >= 0) a.setAttribute('href', '#' + (k + 1 + pageOffset));
  });
  var lastGo = 0;
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    lastGo = Date.now();
    setCurrent(i);
  }

  // ---------- 键盘 / 翻页笔 ----------
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    var next = ['ArrowRight', 'ArrowDown', 'PageDown'];
    var prev = ['ArrowLeft', 'ArrowUp', 'PageUp'];
    if (k === ' ' || k === 'Spacebar') { e.preventDefault(); go(current + (e.shiftKey ? -1 : 1)); }
    else if (next.indexOf(k) >= 0) { e.preventDefault(); go(current + 1); }
    else if (prev.indexOf(k) >= 0) { e.preventDefault(); go(current - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(slides.length - 1); }
  });

  // 点击锚点（导航 / 议程卡片）
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var n = parseInt(a.getAttribute('href').slice(1), 10);
    if (n >= 1) { e.preventDefault(); a.blur(); go(n - 1); }
  });

  // 手机：翻页按钮 + 左右滑动
  document.getElementById('prev').addEventListener('click', function () { go(current - 1); });
  document.getElementById('next').addEventListener('click', function () { go(current + 1); });
  var tx = null, ty = 0;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1 || e.target.closest('.tabs')) { tx = null; return; }
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    tx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // 桌面：滚轮翻页（页面本身不滚动时）
  window.addEventListener('wheel', function (e) {
    var s = slides[current];
    if (!s || s.scrollHeight > s.clientHeight + 2) return;
    if (Math.abs(e.deltaY) < 30 || Date.now() - lastGo < 800) return;
    go(current + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  // 手动改地址栏 #N 时跳转
  window.addEventListener('hashchange', function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n >= 1 && n <= slides.length && n - 1 !== current) setCurrent(n - 1, true);
  });

  // ---------- 初始页：支持 #页码 直接打开某一页 ----------
  var start = parseInt(location.hash.slice(1), 10);
  // 截图模式（?solo#页码）：只渲染这一页，供无头浏览器截图用
  if (/[?&]solo\b/.test(location.search) && slides[start - 1]) {
    slides.forEach(function (s, k) { if (k !== start - 1) s.style.display = 'none'; });
    slides = [slides[start - 1]];
    pageOffset = start - 1;
    start = 1;
  }
  if (start >= 1 && start <= slides.length) setCurrent(start - 1, true);
  else setCurrent(0);

  // 自检模式（?check）：仅用于截图验证，正常演示不会加载
  if (/[?&]check\b/.test(location.search)) {
    var sc = document.createElement('script');
    sc.src = 'tools/check.js';
    document.body.appendChild(sc);
  }
})();
