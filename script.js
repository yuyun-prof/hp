const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');

// Spline intro
const splineIntro = document.querySelector('.spline-intro');

// Scroll progress bar
const progressBar = document.getElementById('scroll-progress-bar');

function updatePageScroll() {
  const scrollY = window.scrollY;

  // 1. Spline 인트로를 지나면 헤더 표시
  if (header && splineIntro) {
    const introHeight = splineIntro.offsetHeight;

    header.classList.toggle(
      'visible',
      scrollY >= introHeight - 80
    );
  }

  // 2. 페이지 스크롤 진행률 계산
  if (progressBar) {
    const scrollableHeight =
      document.documentElement.scrollHeight - window.innerHeight;

    const progress =
      scrollableHeight > 0
        ? (scrollY / scrollableHeight) * 100
        : 0;

    progressBar.style.width = `${Math.min(progress, 100)}%`;
  }
}

window.addEventListener('scroll', updatePageScroll, {
  passive: true
});

window.addEventListener('resize', updatePageScroll);

updatePageScroll();


// 모바일 메뉴
if (menuButton && navLinks) {
  menuButton.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');

    menuButton.setAttribute(
      'aria-expanded',
      String(open)
    );

    document.body.style.overflow = open ? 'hidden' : '';
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}


// 현재 연도
const yearElement = document.getElementById('year');

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}


// 스크롤 등장 애니메이션
const revealTargets = document.querySelectorAll(
  '.section-heading, ' +
  '.research-card, ' +
  '.professor-grid, ' +
  '.publication-list article, ' +
  '.person-card, ' +
  '.news-list article, ' +
  '.resource-grid a, ' +
  '.contact-grid > div'
);

revealTargets.forEach((el) => {
  el.classList.add('reveal');
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.12
  }
);

revealTargets.forEach((el) => {
  observer.observe(el);
});