/* ============================================================
   Central Intelligence Agency — Academia de Polícia
   Script principal: navegação, carrossel, membros (API Habblet)
   ============================================================ */

(function () {
  'use strict';

  /* ===== Configuração de cargos e membros =====
     Cada cargo tem um número fixo de vagas (slots) e uma lista
     de nicks preenchidos. Ao adicionar um novo nick, ele ocupa
     automaticamente o próximo slot vazio daquele cargo. */
  var CARGOS = [
    {
      cargo: 'Comandante',
      vagas: 1,
      descricao: 'O comandante é responsável por conduzir a função garantindo a eficácia no processo de formação dos oficiais da Central Intelligence Agency.',
      membros: ['Lider'],
    },
    {
      cargo: 'Subcomandante',
      vagas: 1,
      descricao: 'O subcomandante é responsável por auxiliar o comandante em suas obrigações (bem como no processo seletivo) e representá-lo em sua ausência.',
      membros: ['vcapelli'],
    },
    {
      cargo: 'Coordenador',
      vagas: 3,
      descricao: 'Os coordenadores são responsáveis pelas tarefas estruturais que mantêm a função organizada.',
      membros: ['Arqui-inimigo'],
    },
    {
      cargo: 'Instrutor',
      vagas: 6,
      descricao: 'Os instrutores são responsáveis pela aplicação do Curso de Formação de Oficiais aos policiais.',
      membros: ['.:Persceu:.', 'Pactus'],
    },
  ];

  /* ===== Grupos de seção da página de membros ===== */
  var MEMBER_SECTIONS = [
    { titulo: 'Comando', cargos: ['Comandante', 'Subcomandante'] },
    { titulo: 'Coordenadores', cargos: ['Coordenador'] },
    { titulo: 'Instrutores', cargos: ['Instrutor'] },
  ];

  /* ===== Slides do carrossel ===== */
  var SLIDES = [
    { src: 'slides/slide1.png', label: 'Slide 1' },
    { src: 'slides/slide2.png', label: 'Slide 2' },
    { src: 'slides/slide3.png', label: 'Slide 3' },
    { src: 'slides/slide4.png', label: 'Slide 4' },
    { src: 'slides/slide5.png', label: 'Slide 5' },
    { src: 'slides/slide6.png', label: 'Slide 6' },
    { src: 'slides/slide7.png', label: 'Slide 7' },
    { src: 'slides/slide8.png', label: 'Slide 8' },
  ];

  /* ===== Metadados das seções ===== */
  var SECTION_META = {
    'boas-vindas': { title: 'Boas-vindas', subtitle: 'Conheça a APM/CFO e prepare-se para sua jornada como membro da Academia.' },
    'como-aplicar': { title: 'Como aplicar', subtitle: 'Instruções e vídeo tutorial sobre aplicação e registros.' },
    'regimento': { title: 'Regimento Interno', subtitle: 'Normas e regras oficiais da companhia.' },
    'membros': { title: 'Membros', subtitle: 'Liderança da Central Intelligence Agency.' },
  };

  /* ===== Elementos do DOM ===== */
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');
  var hamburger = document.getElementById('hamburger');
  var navItems = document.querySelectorAll('.nav-item');
  var sections = document.querySelectorAll('.section');
  var sectionTitle = document.getElementById('section-title');
  var sectionSubtitle = document.getElementById('section-subtitle');
  var topbarTitle = document.getElementById('topbar-title');
  var membersGrid = document.getElementById('members-grid');
  var currentYearEl = document.getElementById('current-year');
  var footerYearEl = document.getElementById('footer-year');

  /* ===== Ano no rodapé ===== */
  var year = new Date().getFullYear();
  if (currentYearEl) currentYearEl.textContent = year;
  if (footerYearEl) footerYearEl.textContent = year;

  /* ===== Navegação entre seções ===== */
  function switchSection(key) {
    navItems.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.section === key);
    });

    sections.forEach(function (sec) {
      sec.classList.toggle('active', sec.id === key);
    });

    var meta = SECTION_META[key];
    if (meta) {
      sectionTitle.textContent = meta.title;
      sectionSubtitle.textContent = meta.subtitle;
      topbarTitle.textContent = meta.title;
    }

    if (key === 'membros' && !membersLoaded) {
      loadMembers();
    }

    closeSidebar();
  }

  navItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchSection(btn.dataset.section);
    });
  });

  /* ===== Sidebar mobile (hambúrguer) ===== */
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    hamburger.classList.add('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    hamburger.classList.remove('open');
  }

  hamburger.addEventListener('click', function () {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay.addEventListener('click', closeSidebar);

  /* ============================================================
     Carrossel / Slideshow (sem autoplay)
     ============================================================ */
  var carouselTrack = document.getElementById('carousel-track');
  var carouselIndicators = document.getElementById('carousel-indicators');
  var carouselPrev = document.getElementById('carousel-prev');
  var carouselNext = document.getElementById('carousel-next');
  var carouselFullscreenBtn = document.getElementById('carousel-fullscreen');
  var currentSlide = 0;

  function buildCarousel() {
    SLIDES.forEach(function (slide, i) {
      var slideEl = document.createElement('div');
      slideEl.className = 'carousel__slide';

      var img = document.createElement('img');
      img.src = slide.src;
      img.alt = slide.label;
      img.loading = 'lazy';

      img.addEventListener('error', function () {
        slideEl.classList.add('carousel__slide--placeholder');
        slideEl.innerHTML =
          '<span class="placeholder-icon">&#128737;</span>' +
          '<span class="placeholder-label">' + slide.label + '</span>';
      });

      slideEl.appendChild(img);
      carouselTrack.appendChild(slideEl);

      var dot = document.createElement('button');
      dot.className = 'carousel__indicator' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Ir para slide ' + (i + 1));
      dot.addEventListener('click', function () {
        goToSlide(i);
      });
      carouselIndicators.appendChild(dot);
    });
  }

  function goToSlide(index) {
    currentSlide = index;
    carouselTrack.style.transform = 'translateX(-' + currentSlide * 100 + '%)';

    var dots = carouselIndicators.querySelectorAll('.carousel__indicator');
    dots.forEach(function (dot, i) {
      dot.classList.toggle('active', i === currentSlide);
    });

    updateFullscreen();
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % SLIDES.length);
  }

  function prevSlide() {
    goToSlide((currentSlide - 1 + SLIDES.length) % SLIDES.length);
  }

  carouselPrev.addEventListener('click', prevSlide);
  carouselNext.addEventListener('click', nextSlide);

  /* ===== Fullscreen do carrossel ===== */
  function openFullscreen() {
    var fsOverlay = document.getElementById('fullscreen-overlay');
    if (!fsOverlay) return;
    updateFullscreen();
    fsOverlay.classList.add('visible');
  }

  function closeFullscreen() {
    var fsOverlay = document.getElementById('fullscreen-overlay');
    if (fsOverlay) fsOverlay.classList.remove('visible');
  }

  function updateFullscreen() {
    var fsImg = document.getElementById('fullscreen-img');
    var fsCounter = document.getElementById('fullscreen-counter');
    var fsOverlay = document.getElementById('fullscreen-overlay');
    if (!fsImg || !fsOverlay || !fsOverlay.classList.contains('visible')) return;
    fsImg.src = SLIDES[currentSlide].src;
    fsImg.alt = SLIDES[currentSlide].label;
    if (fsCounter) fsCounter.textContent = (currentSlide + 1) + ' / ' + SLIDES.length;
  }

  if (carouselFullscreenBtn) {
    carouselFullscreenBtn.addEventListener('click', openFullscreen);
  }

  var fsClose = document.getElementById('fullscreen-close');
  if (fsClose) fsClose.addEventListener('click', closeFullscreen);

  var fsPrev = document.getElementById('fullscreen-prev');
  if (fsPrev) fsPrev.addEventListener('click', function (e) { e.stopPropagation(); prevSlide(); });

  var fsNext = document.getElementById('fullscreen-next');
  if (fsNext) fsNext.addEventListener('click', function (e) { e.stopPropagation(); nextSlide(); });

  var fsOverlayEl = document.getElementById('fullscreen-overlay');
  if (fsOverlayEl) {
    fsOverlayEl.addEventListener('click', function (e) {
      if (e.target === fsOverlayEl) closeFullscreen();
    });
  }

  document.addEventListener('keydown', function (e) {
    var fsOverlayCheck = document.getElementById('fullscreen-overlay');
    if (!fsOverlayCheck || !fsOverlayCheck.classList.contains('visible')) return;
    if (e.key === 'Escape') closeFullscreen();
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'ArrowRight') nextSlide();
  });

  buildCarousel();

  /* ============================================================
     Membros — API Habblet
     ============================================================ */
  var membersLoaded = false;

  function loadMembers() {
    membersLoaded = true;

    MEMBER_SECTIONS.forEach(function (sectionDef) {
      var sectionTitleEl = document.createElement('h3');
      sectionTitleEl.className = 'members-section-title';
      sectionTitleEl.textContent = sectionDef.titulo;
      membersGrid.appendChild(sectionTitleEl);

      var sectionGrid = document.createElement('div');
      sectionGrid.className = 'members-subgrid';
      membersGrid.appendChild(sectionGrid);

      sectionDef.cargos.forEach(function (cargoName) {
        var cargoObj = CARGOS.find(function (c) { return c.cargo === cargoName; });
        if (!cargoObj) return;

        for (var i = 0; i < cargoObj.vagas; i++) {
          var nick = cargoObj.membros[i] || null;

          if (nick) {
            var card = document.createElement('div');
            card.className = 'member-card member-card--loading';
            card.id = 'member-' + sanitizeId(nick);
            card.innerHTML =
              '<div class="member-card__banner"></div>' +
              '<div class="member-card__body">' +
                '<div class="member-card__spinner"></div>' +
                '<p class="member-card__loading-text">Carregando ' + escapeHtml(nick) + '…</p>' +
              '</div>';
            sectionGrid.appendChild(card);

            fetchMember(cargoObj, nick);
          } else {
            var emptyCard = document.createElement('div');
            emptyCard.className = 'member-card member-card--vacant';
            emptyCard.innerHTML =
              '<div class="member-card__banner member-card__banner--vacant"></div>' +
              '<div class="member-card__body">' +
                '<div class="member-card__vacant-icon">' +
                  '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
                    '<circle cx="12" cy="8" r="4"/>' +
                    '<path d="M4 20v-1a6 6 0 0 1 12 0v1"/>' +
                  '</svg>' +
                '</div>' +
                '<div class="member-card__role">' + escapeHtml(cargoObj.cargo) + '</div>' +
                '<div class="member-card__vacant-label">Vaga disponível</div>' +
              '</div>';
            sectionGrid.appendChild(emptyCard);
          }
        }
      });
    });
  }

  async function fetchMember(cargoObj, nick) {
    var cardId = 'member-' + sanitizeId(nick);
    var card = document.getElementById(cardId);
    if (!card) return;

    var playerUrl = 'https://api.habblet.city/player/' + encodeURIComponent(nick);

    try {
      var resp = await fetch(playerUrl);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);

      var data = await resp.json();
      var figure = data.figure || '';
      var playerName = data.name || nick;

      var avatarUrl =
        'https://imaging.habblet.city/avatarimage?figure=' +
        encodeURIComponent(figure) +
        '&headonly=1&direction=2&head_direction=2&size=m&img_format=png';

      card.className = 'member-card';
      card.innerHTML =
        '<div class="member-card__banner"></div>' +
        '<div class="member-card__avatar">' +
          '<img src="' + escapeAttr(avatarUrl) + '" alt="Avatar de ' + escapeAttr(playerName) + '">' +
        '</div>' +
        '<div class="member-card__body">' +
          '<div class="member-card__role">' + escapeHtml(cargoObj.cargo) + '</div>' +
          '<div class="member-card__nick">' + escapeHtml(playerName) + '</div>' +
          '<div class="member-card__desc">' + escapeHtml(cargoObj.descricao) + '</div>' +
        '</div>';

      // Se a imagem do avatar falhar ao carregar, substitui por fallback
      var avatarImg = card.querySelector('.member-card__avatar img');
      if (avatarImg) {
        avatarImg.addEventListener('error', function () {
          var avatarDiv = card.querySelector('.member-card__avatar');
          if (avatarDiv) {
            avatarDiv.classList.add('member-card__avatar--fallback');
            avatarDiv.innerHTML = getFallbackAvatarSvg();
          }
        });
      }
    } catch (err) {
      // Fallback: mostra o card normalmente com nick e descrição, mas sem foto
      card.className = 'member-card';
      card.innerHTML =
        '<div class="member-card__banner"></div>' +
        '<div class="member-card__avatar member-card__avatar--fallback">' +
          getFallbackAvatarSvg() +
        '</div>' +
        '<div class="member-card__body">' +
          '<div class="member-card__role">' + escapeHtml(cargoObj.cargo) + '</div>' +
          '<div class="member-card__nick">' + escapeHtml(nick) + '</div>' +
          '<div class="member-card__desc">' + escapeHtml(cargoObj.descricao) + '</div>' +
        '</div>';
    }
  }

  function getFallbackAvatarSvg() {
    return '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="8" r="4"/>' +
      '<path d="M4 20v-1a6 6 0 0 1 12 0v1"/>' +
      '</svg>';
  }

  /* ===== Utilitários ===== */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function sanitizeId(str) {
    return String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

})();
