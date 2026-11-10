/* ==========================================================
   Интерфейс: меню, появление блоков, липкая панель, форма
   ========================================================== */
(function () {
  'use strict';

  var header = document.querySelector('.header');
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('nav');
  var mobileCta = document.getElementById('mobileCta');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- мобильное меню ---------- */

  if (header && burger && nav) {
    var setMenu = function (open) {
      header.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };

    burger.addEventListener('click', function () {
      setMenu(!header.classList.contains('is-open'));
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && header.classList.contains('is-open')) {
        setMenu(false);
        burger.focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (!header.classList.contains('is-open')) return;
      if (!header.contains(event.target)) setMenu(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) setMenu(false);
    });
  }

  /* ---------- тень шапки ---------- */

  if (header) {
    var lastScrolled = false;
    var onScroll = function () {
      var scrolled = window.scrollY > 8;
      if (scrolled !== lastScrolled) {
        lastScrolled = scrolled;
        header.classList.toggle('is-scrolled', scrolled);
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- появление секций ---------- */

  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (!revealItems.length) {
    // ничего не делаем
  } else if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(function (item) { revealObserver.observe(item); });
  }

  /* ---------- липкая панель на мобильных ---------- */

  if (mobileCta) {
    var hero = document.querySelector('.hero');
    var formSection = document.getElementById('form');
    var ctaTick = false;

    var updateCta = function () {
      ctaTick = false;
      if (!hero) return;

      var show = hero.getBoundingClientRect().bottom < -40;

      if (show && formSection) {
        var rect = formSection.getBoundingClientRect();
        var viewport = window.innerHeight || 800;
        if (rect.top < viewport * 0.75 && rect.bottom > viewport * 0.25) {
          show = false;
        }
      }

      mobileCta.classList.toggle('is-visible', show);
    };

    var requestCtaUpdate = function () {
      if (ctaTick) return;
      ctaTick = true;
      window.requestAnimationFrame(updateCta);
    };

    updateCta();
    window.addEventListener('scroll', requestCtaUpdate, { passive: true });
    window.addEventListener('resize', requestCtaUpdate);
    window.addEventListener('load', requestCtaUpdate);
  }

  /* ---------- iframe Яндекс Формы ---------- */

  var formFrame = document.querySelector('[data-form-frame]');
  if (formFrame) {
    var iframe = formFrame.querySelector('iframe');
    var formFallback = formFrame.querySelector('.form-frame__fallback');
    var formLoaded = false;
    var fallbackTimer = null;

    var markLoaded = function () {
      formLoaded = true;

      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      formFrame.classList.remove('is-failed');
      formFrame.classList.add('is-loaded');
      if (formFallback) formFallback.hidden = true;
    };

    var showFallback = function () {
      if (formLoaded) return;
      formFrame.classList.add('is-failed');
      if (formFallback) formFallback.hidden = false;
    };

    var isFormMessage = function (event) {
      if (iframe && event.source && event.source !== iframe.contentWindow) return false;

      var host = '';
      try {
        host = new URL(event.origin).hostname;
      } catch (error) {
        return false;
      }

      return /(^|\.)yandex\.ru$/.test(host);
    };

    // Форма присылает высоту через postMessage только после успешной загрузки.
    // Если сообщения нет — значит, iframe показывает ошибку или заблокирован.
    window.addEventListener('message', function (event) {
      if (formLoaded || !isFormMessage(event)) return;
      markLoaded();
    });

    if (iframe) {
      var armFallback = function () {
        if (formLoaded || fallbackTimer) return;
        fallbackTimer = window.setTimeout(showFallback, 12000);
      };

      iframe.addEventListener('load', armFallback);

      if (!('IntersectionObserver' in window)) {
        armFallback();
      } else {
        var frameObserver = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) {
            frameObserver.disconnect();
            armFallback();
          }
        }, { rootMargin: '300px' });

        frameObserver.observe(formFrame);
      }
    } else {
      showFallback();
    }
  }

  /* ---------- фото в первом экране ---------- */

  var photoBox = document.querySelector('[data-photo]');
  if (photoBox) {
    var photo = photoBox.querySelector('img');
    if (photo) {
      var markPhotoFailed = function () {
        photoBox.classList.remove('has-photo');
        photoBox.classList.add('is-failed');
      };

      var markPhotoLoaded = function () {
        photoBox.classList.remove('is-failed');
        photoBox.classList.add('has-photo');
      };

      photo.addEventListener('error', markPhotoFailed);
      photo.addEventListener('load', markPhotoLoaded);

      if (photo.complete && photo.naturalWidth > 0) markPhotoLoaded();
      if (photo.complete && photo.naturalWidth === 0) markPhotoFailed();
    }
  }
})();
