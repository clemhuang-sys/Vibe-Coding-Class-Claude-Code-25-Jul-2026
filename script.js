/* ==========================================================================
   Meridian & Co. — nav toggle, enquiry form, and quiet motion
   Vanilla JS, no dependencies.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Formspree endpoint

     Replace {YOUR_FORM_ID} with the ID from your Formspree dashboard, e.g.
       https://formspree.io/f/xdorwvpk
     Until you do, the form runs in demo mode (see handleSubmit below).
     ------------------------------------------------------------------------ */
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/{YOUR_FORM_ID}';
  var IS_PLACEHOLDER = FORMSPREE_ENDPOINT.indexOf('{YOUR_FORM_ID}') !== -1;

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------------ */
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------------
     Mobile nav
     ------------------------------------------------------------------------ */
  var navToggle = document.getElementById('nav-toggle');
  var navMenu = document.getElementById('nav-menu');

  navToggle.addEventListener('click', function () {
    var open = navMenu.dataset.open === 'true';
    navMenu.dataset.open = String(!open);
    navToggle.setAttribute('aria-expanded', String(!open));
  });

  // Collapse the menu once a link has been followed on small screens.
  navMenu.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      navMenu.dataset.open = 'false';
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  /* ------------------------------------------------------------------------
     Enquiry form
     ------------------------------------------------------------------------ */
  var form = document.getElementById('enquiry-form');
  var submitBtn = document.getElementById('submit-btn');
  var status = document.getElementById('form-status');
  var SUBMIT_LABEL = submitBtn.textContent.trim();

  // One rule per field. Returns an error string, or '' when valid.
  // `company` is intentionally absent — it is optional.
  var rules = {
    name: function (value) {
      if (!value.trim()) return 'Please enter your name.';
      if (value.trim().length < 2) return 'That name looks too short.';
      return '';
    },
    email: function (value) {
      if (!value.trim()) return 'Please enter your email address.';
      // Deliberately permissive: catches typos without rejecting valid addresses.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) {
        return 'Please enter a valid email address, e.g. name@company.com.';
      }
      return '';
    },
    message: function (value) {
      if (!value.trim()) return 'Please tell us a little about what you\'re growing.';
      if (value.trim().length < 20) return 'Please add a bit more detail (20 characters or more).';
      return '';
    }
  };

  function showError(field, message) {
    var errorEl = document.getElementById(field.id + '-error');
    if (errorEl) errorEl.textContent = message;
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validateField(field) {
    var rule = rules[field.id];
    if (!rule) return true;
    var message = rule(field.value);
    showError(field, message);
    return message === '';
  }

  // Validate on blur, then live-correct only once a field has been flagged —
  // so nobody gets shouted at halfway through typing their email.
  Object.keys(rules).forEach(function (id) {
    var field = document.getElementById(id);
    field.addEventListener('blur', function () { validateField(field); });
    field.addEventListener('input', function () {
      if (field.getAttribute('aria-invalid') === 'true') validateField(field);
    });
  });

  function setStatus(state, message) {
    status.dataset.state = state;
    status.textContent = message;
  }

  function clearStatus() {
    delete status.dataset.state;
    status.textContent = '';
  }

  function setSending(isSending) {
    submitBtn.disabled = isSending;
    submitBtn.textContent = isSending ? 'Sending…' : SUBMIT_LABEL;
  }

  function onSuccess(firstName) {
    setStatus('success', 'Thank you' + (firstName ? ', ' + firstName : '') +
      ' — your diagnostic is on its way. A consultant replies within one working day.');
    form.reset();
    Object.keys(rules).forEach(function (id) {
      showError(document.getElementById(id), '');
    });
  }

  // Demo mode is neither success nor failure. Say plainly that nothing was sent,
  // and leave the fields filled — a reset would imply the message went somewhere.
  function onDemo() {
    setStatus('notice', 'Demo mode — your message was not sent. This form isn\'t ' +
      'connected to a mailbox; the payload was logged to the browser console instead.');
  }

  function onFailure(message) {
    setStatus('error', message ||
      'Sorry, we couldn\'t send that. Please email hello@meridianco.example instead.');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearStatus();

    // ---- 1. Validate ------------------------------------------------------
    var firstInvalid = null;
    var isValid = true;

    Object.keys(rules).forEach(function (id) {
      var field = document.getElementById(id);
      if (!validateField(field)) {
        isValid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });

    if (!isValid) {
      setStatus('error', 'Please fix the highlighted fields and try again.');
      if (firstInvalid) firstInvalid.focus();
      return;                            // nothing leaves the browser
    }

    // ---- 2. Build the payload --------------------------------------------
    // form.elements, not form.name — HTMLFormElement.name is the form's own attribute.
    var fields = form.elements;
    var payload = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      company: fields.company.value.trim(),
      message: fields.message.value.trim()
    };
    var firstName = payload.name.split(' ')[0];

    // ---- 3. Demo mode ----------------------------------------------------
    // No real endpoint yet, so skip the network call rather than showing an
    // error for a 404. This must NOT claim success: the page is public, and
    // telling a visitor their enquiry is on its way when it was discarded is a
    // lie. Delete this block once you paste in your form ID.
    if (IS_PLACEHOLDER) {
      setSending(true);
      console.log('Enquiry (demo mode — no form ID set):', payload);
      window.setTimeout(function () {
        setSending(false);
        onDemo();
      }, 600);
      return;
    }

    // ---- 4. Send to Formspree --------------------------------------------
    setSending(true);

    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        if (response.ok) {                       // 200 — Formspree accepted it
          onSuccess(firstName);
          return;
        }
        // Formspree returns { errors: [{ message, field }] } on a rejection.
        return response.json()
          .then(function (data) {
            var detail = data && data.errors
              ? data.errors.map(function (e) { return e.message; }).join(' ')
              : '';
            onFailure(detail);
          })
          .catch(function () {
            onFailure('');                       // body wasn't JSON
          });
      })
      .catch(function (error) {
        console.error('Enquiry failed:', error);
        onFailure('Network error — please check your connection and try again.');
      })
      .finally(function () {
        setSending(false);
      });
  });

  /* ------------------------------------------------------------------------
     Quiet motion — scroll reveal + the seal "stamp"
     Skipped entirely when the visitor prefers reduced motion, or when
     IntersectionObserver isn't available.
     ------------------------------------------------------------------------ */
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    var revealTargets = document.querySelectorAll(
      '.head, .discipline, .colophon, .offer, .form, .faq__item, .proof'
    );
    revealTargets.forEach(function (el) { el.classList.add('reveal'); });

    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach(function (el) { revealObserver.observe(el); });

    // Safety net: reveal is decorative only. If the observer never fires for an
    // element (odd viewport, backgrounded tab, fullpage capture), it must never
    // stay hidden — force everything visible after a short grace period.
    window.setTimeout(function () {
      revealTargets.forEach(function (el) { el.classList.add('is-in'); });
    }, 2500);

    // Stamp each CTA once, the first time it scrolls into view.
    var stampObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-stamped');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.9 });

    document.querySelectorAll('.btn[data-stamp]').forEach(function (el) {
      stampObserver.observe(el);
    });
  }
})();
