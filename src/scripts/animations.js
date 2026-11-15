// Animations au défilement (design system, section « Mouvement »).
// Chaque élément s'anime une seule fois, quand il entre dans l'écran. Rien ne tourne en boucle.
// Sans JavaScript, ou si le visiteur demande moins d'animations, tout s'affiche directement.
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var main = document.querySelector('main');
  if (!main) return;
  var racine = document.documentElement;

  try {
    racine.classList.add('js-anim');
    var marque = function (el, type) { el.setAttribute('data-anim', type); };
    var dejaPris = function (el) { return !!(el.parentElement && el.parentElement.closest('[data-anim]')); };
    // Le texte des pages légales reste immobile : il se lit, il ne se montre pas.
    // Le tri des tâches du premier écran et le cristal ont leur propre animation.
    var horsChamp = function (el) { return !!el.closest('.legal, .tri, .cristal'); };

    // 1. Blocs entiers : la fiche, le portrait, les cartes et les lignes de liste.
    main.querySelectorAll('.pyr-specimen').forEach(function (el) { marque(el, 'fiche'); });
    main.querySelectorAll('.presentation > img').forEach(function (el) { marque(el, 'portrait'); });
    main.querySelectorAll('.grille > *, .pyr-forfaits > *, .faq__item, .parcours__etape, .detail-offre > *, .rangee, .calendrier, .emplacement-photo')
      .forEach(function (el) { if (!dejaPris(el) && !horsChamp(el)) marque(el, 'monte'); });

    // 2. Grands titres : chaque mot monte derrière un cache.
    main.querySelectorAll('h1, h2').forEach(function (titre) {
      if (dejaPris(titre) || titre.children.length || (horsChamp(titre) && titre.tagName !== 'H1')) return;
      // On coupe sur les espaces ordinaires seulement : les espaces insécables (avant « : ») restent collés.
      var mots = titre.textContent.trim().split(/[ \t\r\n]+/);
      titre.textContent = '';
      mots.forEach(function (mot, i) {
        var cache = document.createElement('span');
        cache.className = 'mot';
        var interieur = document.createElement('span');
        interieur.className = 'mot__in';
        interieur.style.setProperty('--i', i);
        interieur.textContent = mot;
        cache.appendChild(interieur);
        titre.appendChild(cache);
        if (i < mots.length - 1) titre.appendChild(document.createTextNode(' '));
      });
      marque(titre, 'mots');
    });

    // 3. Le diviseur à facettes se trace de gauche à droite.
    main.querySelectorAll('.pyr-diviseur').forEach(function (el) { if (!dejaPris(el) && !horsChamp(el)) marque(el, 'trace'); });

    // 4. Tout le reste du texte : fondu et montée.
    main.querySelectorAll('.pyr-label, p, .t-accroche, .t-annexe, .pyr-lien, .pyr-btn, figure, li, dl, table, .a-fournir')
      .forEach(function (el) { if (!el.hasAttribute('data-anim') && !dejaPris(el) && !horsChamp(el)) marque(el, 'monte'); });

    // Fiche spécimen : chaque ligne s'inscrit à son tour, la valeur comme à la machine à écrire.
    main.querySelectorAll('[data-anim="fiche"]').forEach(function (fiche) {
      fiche.querySelectorAll('dt').forEach(function (dt, i) {
        dt.style.setProperty('--i', i);
        var dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD') {
          dd.style.setProperty('--i', i);
          dd.style.setProperty('--n', Math.max(1, dd.textContent.trim().length));
        }
      });
    });

    // Numéros d'étape (01, 02…) : chaque chiffre défile comme un compteur mécanique.
    main.querySelectorAll('.t-chiffre[aria-hidden="true"]').forEach(function (el) {
      var texte = el.textContent.trim();
      if (!/^\d+$/.test(texte)) return;
      el.textContent = '';
      texte.split('').forEach(function (chiffre, j) {
        var fenetre = document.createElement('span');
        fenetre.className = 'compteur';
        var colonne = document.createElement('span');
        colonne.className = 'compteur__colonne';
        colonne.style.setProperty('--j', j);
        colonne.style.setProperty('--cible', 10 + Number(chiffre));
        for (var k = 0; k < 20; k++) {
          var c = document.createElement('span');
          c.textContent = String(k % 10);
          colonne.appendChild(c);
        }
        fenetre.appendChild(colonne);
        el.appendChild(fenetre);
      });
    });

    // Déclenchement : les éléments qui entrent ensemble arrivent l'un après l'autre, dans l'ordre de lecture.
    var reveler = function (el, rang) {
      el.style.setProperty('--delai', Math.min(rang, 6) * 90 + 'ms');
      el.classList.add('est-visible');
    };
    var observateur = new IntersectionObserver(function (entrees) {
      var lot = [];
      entrees.forEach(function (e) {
        if (e.isIntersecting) lot.push(e.target);
        // Déjà dépassé (retour sur une page, saut d'ancre) : affiché tout de suite.
        else if (e.boundingClientRect.bottom < 0) { reveler(e.target, 0); observateur.unobserve(e.target); }
      });
      lot.sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
      lot.forEach(function (el, rang) { reveler(el, rang); observateur.unobserve(el); });
    }, { rootMargin: '0px 0px -8% 0px' });
    var restants = Array.prototype.slice.call(main.querySelectorAll('[data-anim]'));
    restants.forEach(function (el) { observateur.observe(el); });

    // Fine ligne laiton sous l'en-tête : la progression de lecture de la page.
    var entete = document.querySelector('.en-tete');
    var ligne = null;
    if (entete) {
      ligne = document.createElement('span');
      ligne.className = 'progression-lecture';
      ligne.setAttribute('aria-hidden', 'true');
      entete.appendChild(ligne);
    }
    var enAttente = false;
    var mesurer = function () {
      enAttente = false;
      if (ligne) {
        var course = document.documentElement.scrollHeight - window.innerHeight;
        ligne.style.setProperty('--progression', course > 0 ? Math.min(1, window.scrollY / course) : 0);
      }
      // Saut rapide (touche Fin, lien d'ancre) : ce qui a été survolé sans être vu s'affiche aussi.
      restants = restants.filter(function (el) {
        if (el.classList.contains('est-visible')) return false;
        if (el.getBoundingClientRect().bottom < 0) { reveler(el, 0); observateur.unobserve(el); return false; }
        return true;
      });
    };
    var demander = function () { if (!enAttente) { enAttente = true; requestAnimationFrame(mesurer); } };
    window.addEventListener('scroll', demander, { passive: true });
    window.addEventListener('resize', demander);
    mesurer();
  } catch (erreur) {
    // En cas de problème, on affiche tout plutôt que de laisser du texte caché.
    racine.classList.remove('js-anim');
  }
})();
