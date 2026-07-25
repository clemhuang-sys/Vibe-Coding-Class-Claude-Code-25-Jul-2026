/* ==========================================================================
   Meridian & Co. — nav toggle + enquiry form
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
      if (!value.trim()) return 'Please tell us a little about your project.';
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
    setStatus('success', 'Thanks' + (firstName ? ', ' + firstName : '') +
      ' — your enquiry is on its way. We\'ll reply within one working day.');
    form.reset();
    Object.keys(rules).forEach(function (id) {
      showError(document.getElementById(id), '');
    });
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
    // error for a 404. Delete this block once you paste in your form ID.
    if (IS_PLACEHOLDER) {
      setSending(true);
      console.log('Enquiry (demo mode — no form ID set):', payload);
      window.setTimeout(function () {
        setSending(false);
        onSuccess(firstName);
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
})();
