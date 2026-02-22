/* ============================================
   MAIN JAVASCRIPT - Global Functionality
   ============================================ */

// Navigation handler
document.addEventListener('DOMContentLoaded', function () {
  initializeNavigation();
  initializeScrollAnimations();
  initializeFormHandlers();
  initializeAccordions();
});

// ============================================
// NAVIGATION
// ============================================

function initializeNavigation() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.navbar-menu');
  const navLinks = document.querySelectorAll('.navbar-menu a');

  if (hamburger) {
    hamburger.addEventListener('click', function () {
      navMenu.classList.toggle('active');
    });
  }

  // Close menu when a link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', function () {
      navMenu.classList.remove('active');

      // Update active link
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', function (event) {
    if (!event.target.closest('nav') && navMenu.classList.contains('active')) {
      navMenu.classList.remove('active');
    }
  });

  // Update active link on page load
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// ============================================
// SCROLL ANIMATIONS
// ============================================

function initializeScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in-up');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all cards and sections
  document.querySelectorAll('.card, .stat, .service-item, .testimonial').forEach(el => {
    observer.observe(el);
  });

  // Observe section headings
  document.querySelectorAll('.section h2, .section h3').forEach(el => {
    observer.observe(el);
  });
}

// ============================================
// FORM HANDLERS
// ============================================

function initializeFormHandlers() {
  const quoteForm = document.getElementById('quoteForm');
  const contactForm = document.getElementById('contactForm');
  const trackingForm = document.getElementById('trackingForm');

  if (quoteForm) {
    quoteForm.addEventListener('submit', handleQuoteSubmit);
  }

  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
  }

  if (trackingForm) {
    trackingForm.addEventListener('submit', handleTrackingSubmit);
  }
}

function handleQuoteSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!form || form.getAttribute('data-submitting') === 'true') {
    return;
  }

  form.setAttribute('data-submitting', 'true');
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton ? submitButton.textContent : '';

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
  }

  const formData = new FormData(form);
  const ajaxAction = form.action.includes('/ajax/')
    ? form.action
    : form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');

  fetch(ajaxAction, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Form submission failed');
      }
      showNotification('Thanks! Your quote request has been sent.', 'success');
      form.reset();
    })
    .catch(() => {
      showNotification('Unable to send right now. Redirecting to the form...', 'error');
      form.submit();
    })
    .finally(() => {
      form.removeAttribute('data-submitting');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText || 'Send Request';
      }
    });
}

function handleContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!form || form.getAttribute('data-submitting') === 'true') {
    return;
  }

  form.setAttribute('data-submitting', 'true');
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton ? submitButton.textContent : '';

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
  }

  const formData = new FormData(form);

  const ajaxAction = form.action.includes('/ajax/')
    ? form.action
    : form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');

  fetch(ajaxAction, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Form submission failed');
      }
      showNotification('Thanks! Your message has been sent.', 'success');
      form.reset();
    })
    .catch(() => {
      showNotification('Unable to send right now. Redirecting to the form...', 'error');
      form.submit();
    })
    .finally(() => {
      form.removeAttribute('data-submitting');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText || 'Send Message';
      }
    });
}

function handleTrackingSubmit(e) {
  e.preventDefault();
  const trackingId = document.getElementById('trackingId').value;

  if (!trackingId.trim()) {
    alert('Please enter a tracking ID');
    return;
  }

  // Simulate tracking data
  const trackingData = {
    'SETU001': {
      status: 'In Transit',
      progress: 65,
      origin: 'Mumbai, India',
      destination: 'Delhi, India',
      estimatedDelivery: '2025-02-10',
      lastUpdate: '2025-02-07 14:30'
    },
    'SETU002': {
      status: 'Delivered',
      progress: 100,
      origin: 'Bangalore, India',
      destination: 'Hyderabad, India',
      estimatedDelivery: '2025-02-06',
      lastUpdate: '2025-02-06 10:15'
    },
    'SETU003': {
      status: 'Processing',
      progress: 25,
      origin: 'Pune, India',
      destination: 'Chennai, India',
      estimatedDelivery: '2025-02-12',
      lastUpdate: '2025-02-07 11:00'
    }
  };

  const result = trackingData[trackingId.toUpperCase()];
  const resultDiv = document.getElementById('trackingResult');

  if (result) {
    resultDiv.innerHTML = `
      <div class="tracking-card">
        <div class="tracking-header">
          <h3>Shipment Status</h3>
          <span class="status-badge status-${result.status.toLowerCase().replace(' ', '-')}">${result.status}</span>
        </div>
        
        <div class="tracking-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${result.progress}%"></div>
          </div>
          <span class="progress-text">${result.progress}% Delivered</span>
        </div>

        <div class="tracking-info grid--2">
          <div class="info-item">
            <label>Origin</label>
            <p>${result.origin}</p>
          </div>
          <div class="info-item">
            <label>Destination</label>
            <p>${result.destination}</p>
          </div>
          <div class="info-item">
            <label>Estimated Delivery</label>
            <p>${result.estimatedDelivery}</p>
          </div>
          <div class="info-item">
            <label>Last Update</label>
            <p>${result.lastUpdate}</p>
          </div>
        </div>

        <div class="tracking-timeline">
          <h4>Shipment Timeline</h4>
          <div class="timeline">
            <div class="timeline-item completed">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <strong>Pickup</strong>
                <p>Shipment picked up from origin</p>
              </div>
            </div>
            <div class="timeline-item completed">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <strong>In Transit</strong>
                <p>Shipment is on its way to destination</p>
              </div>
            </div>
            <div class="timeline-item ${result.progress >= 100 ? 'completed' : ''}">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <strong>Delivery</strong>
                <p>Shipment delivered to destination</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    resultDiv.style.display = 'block';
  } else {
    resultDiv.innerHTML = `
      <div class="alert alert-error">
        <p>Tracking ID not found. Please verify and try again.</p>
        <small>Try: SETU001, SETU002, or SETU003</small>
      </div>
    `;
    resultDiv.style.display = 'block';
  }
}

// ============================================
// ACCORDION FUNCTIONALITY
// ============================================

function initializeAccordions() {
  const accordionItems = document.querySelectorAll('.accordion-item');

  accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');

    if (header) {
      header.addEventListener('click', function () {
        const content = item.querySelector('.accordion-content');
        const isActive = item.classList.contains('active');

        // Close all other accordions
        accordionItems.forEach(otherItem => {
          otherItem.classList.remove('active');
        });

        // Toggle current accordion
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href !== '#') {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    }
  });
});

// Format phone number
function formatPhoneNumber(input) {
  const value = input.value.replace(/\D/g, '');
  if (value.length > 10) {
    input.value = value.slice(0, 10);
  }
}

// Validate email
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
