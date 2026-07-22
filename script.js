// music
  const tracks = [
    {
      title: "Music 01",
      artist: "Playlist",
      src: "assets/m/d5-01.m4a"
    },
    {
      title: "Music 02",
      artist: "Playlist",
      src: "assets/m/d5-02.m4a"
    },
    {
      title: "Music 03",
      artist: "Playlist",
      src: "assets/m/d5-05.m4a"
    },
    {
      title: "Music 04",
      artist: "Playlist",
      src: "assets/m/d5-07.m4a"
    },
    {
      title: "Music 05",
      artist: "Playlist",
      src: "assets/m/d7-02.m4a"
    },
    {
      title: "Music 06",
      artist: "Playlist",
      src: "assets/m/d7-04.m4a"
    },
    {
      title: "Music 07",
      artist: "Playlist",
      src: "assets/m/d7-06.m4a"
    },
    {
      title: "Music 08",
      artist: "Playlist",
      src: "assets/m/d7-08.m4a"
    },
    {
      title: "Music 09",
      artist: "Playlist",
      src: "assets/m/d7-14.m4a"
    },
    {
      title: "Music 10",
      artist: "Playlist",
      src: "assets/m/d11-02.m4a"
    }
  ];

  const audioPlayer = document.getElementById("audioPlayer");
  const playButton = document.getElementById("playButton");
  const playButtonIcon = document.getElementById("playButtonIcon");
  const nextButton = document.getElementById("nextButton");
  const musicTitle = document.getElementById("musicTitle");
  const musicArtist = document.getElementById("musicArtist");

  let currentTrackIndex = -1;

  function getRandomTrackIndex() {
    if (tracks.length === 1) {
      return 0;
    }

    let randomIndex;

    do {
      randomIndex = Math.floor(Math.random() * tracks.length);
    } while (randomIndex === currentTrackIndex);

    return randomIndex;
  }

  function loadRandomTrack() {
    currentTrackIndex = getRandomTrackIndex();
  
    const track = tracks[currentTrackIndex];
  
    audioPlayer.src = track.src;
    audioPlayer.load();
  
    // 텍스트 요소가 있을 때만 변경
    if (musicTitle) {
      musicTitle.textContent = track.title;
    }
  
    if (musicArtist) {
      musicArtist.textContent = track.artist;
    }
  }

  function showPlayingIcon() {
    playButtonIcon.src = "assets/icon/stop.png";
    playButton.setAttribute("aria-label", "정지");
  }

  function showStoppedIcon() {
    playButtonIcon.src = "assets/icon/play.png";
    playButton.setAttribute("aria-label", "재생");
  }

  async function playMusic() {
    console.log("playMusic 호출");
    console.log("재생 전 readyState:", audioPlayer.readyState);
  
    try {
      await audioPlayer.play();
  
      console.log("재생 성공");
      console.log("재생 후 paused:", audioPlayer.paused);
  
      showPlayingIcon();
    } catch (error) {
      console.error("재생 실패:", error.name, error.message);
  
      showStoppedIcon();
    }
  }

  function stopMusic() {
    audioPlayer.pause();
    showStoppedIcon();
  }

  function toggleMusic() {
    console.log("toggleMusic 호출");
    console.log("paused:", audioPlayer.paused);
    console.log("readyState:", audioPlayer.readyState);
    console.log("currentSrc:", audioPlayer.currentSrc);
  
    if (audioPlayer.paused) {
      playMusic();
    } else {
      stopMusic();
    }
  }

  async function playNextRandomTrack() {
    loadRandomTrack();
    await playMusic();
  }


  audioPlayer.addEventListener("loadstart", () => {
    console.log("오디오 로드 시작");
  });
  audioPlayer.addEventListener("loadedmetadata", () => {
    console.log("메타데이터 로드 완료");
  });
  audioPlayer.addEventListener("canplay", () => {
    console.log("재생 가능 상태");
  });
  audioPlayer.addEventListener("playing", () => {
    console.log("실제 재생 시작");
  });
  audioPlayer.addEventListener("waiting", () => {
    console.log("버퍼링 중");
  });
  playButton.addEventListener("click", toggleMusic);

nextButton.addEventListener("click", playNextRandomTrack);

audioPlayer.addEventListener("ended", async () => {
  loadRandomTrack();
  await playMusic();
});

audioPlayer.addEventListener("play", showPlayingIcon);
audioPlayer.addEventListener("pause", showStoppedIcon);

audioPlayer.addEventListener("error", () => {
  console.error("오디오 오류:", audioPlayer.error);
  showStoppedIcon();

  if (musicArtist) {
    musicArtist.textContent = "파일을 불러올 수 없습니다";
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  audioPlayer.volume = 0.55;
  loadRandomTrack();

  try {
    await audioPlayer.play();

    console.log("자동재생 성공");
    showPlayingIcon();
  } catch (error) {
    console.log(
      "자동재생 차단:",
      error.name,
      error.message
    );

    showStoppedIcon();
  }
});




// 시작
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