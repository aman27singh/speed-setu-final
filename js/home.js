// Home page specific JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Scroll-triggered animations for hero
  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    heroContent.style.animation = 'fadeInUp 1s ease-out';
  }

  // Stagger service card animations
  const serviceCards = document.querySelectorAll('.service-card');
  serviceCards.forEach((card, index) => {
    card.style.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s both`;
  });
});
