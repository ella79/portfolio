(function(){
  "use strict";
  /* A hash never reaches the server, so a wrong one cannot answer 404 by itself.
     These two rules make the address bar behave the way a visitor expects:
     anchors that used to exist keep working, anything else is a wrong address. */
  var legacyAnchors = { approach: "about", skills: "experience" };
  (function checkHash(){
    var id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch(e){ id = location.hash.slice(1); }
    if(!id || document.getElementById(id)){ return; }
    if(legacyAnchors[id]){ location.replace("#" + legacyAnchors[id]); return; }
    location.replace("404.html");
  })();

  /* Chrome remembers where you were and puts you back there on reload, so a
     visitor who last looked at the footer reopens the page in the footer with
     the footer's section highlighted. A portfolio should open at the top; a
     shared address that names a section is the one case that still wins. */
  try {
    if("scrollRestoration" in history){
      history.scrollRestoration = "manual";
      if(!location.hash){ window.addEventListener("load", function(){ window.scrollTo(0, 0); }); }
    }
  } catch(e){}

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* header state + sticky cta */
  var header = document.getElementById("siteHeader");
  var cta = document.getElementById("stickyCta");
  var ctaStart = document.getElementById("about");
  /* Projects is the last section before Contact, so by the time it is on screen
     the real contact details are one scroll away and the floating button is
     just noise in front of them. */
  var ctaStop = document.getElementById("work") || document.getElementById("contact");
  function ctaVisible(y){
    /* The floating button is only useful between the point where someone is
       reading about the work and the point where contact is already in reach.
       On the CV page there is no contact section, so it stays. */
    if(!ctaStart){ return y > 400; }
    var started = y + header.offsetHeight >= ctaStart.offsetTop - 120;
    var nearlyThere = ctaStop && (y + window.innerHeight >= ctaStop.offsetTop + 120);
    return started && !nearlyThere;
  }
  function onScroll(){
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if(header){ header.classList.toggle("is-stuck", y > 24); }
    if(cta){ cta.classList.toggle("on", ctaVisible(y)); }
  }
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();

  /* smooth scroll that survives sandboxed iframes */
  var navSectionLinks = [].slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var lastNavSectionId = navSectionLinks.length
    ? navSectionLinks[navSectionLinks.length - 1].getAttribute("href").slice(1)
    : "";
  document.querySelectorAll('a[href^="#"]').forEach(function(link){
    link.addEventListener("click", function(e){
      var id = link.getAttribute("href").slice(1);
      if(!id){ return; }
      var target = document.getElementById(id);
      if(target){
        e.preventDefault();
        var y = window.pageYOffset || document.documentElement.scrollTop;
        var top = target.getBoundingClientRect().top + y - header.offsetHeight;
        var end = document.documentElement.scrollHeight - window.innerHeight;
        /* Only the last section reaches for the end of the page: stopping at its
           top would leave the footer below the fold, and the footer is where the
           links live. Every other section stops at its own top, or a section that
           merely sits near the end would be skipped past. */
        var to = top;
        if(id === lastNavSectionId){
          var below = document.documentElement.scrollHeight - (target.getBoundingClientRect().top + y);
          /* And only when the section and the footer both still fit on the
             screen. On a narrow one they do not, and reaching for the end would
             scroll straight past the heading. */
          if(below <= window.innerHeight){ to = Math.max(top, end); }
        }
        window.scrollTo({ top: Math.max(0, to), behavior: reduce ? "auto" : "smooth" });
        try{ if(history.pushState){ history.pushState(null, "", "#" + id); } }catch(err){}
      }
    });
  });

  /* active nav item: highlighted on click, and kept in step while scrolling */
  var navLinks = [].slice.call(document.querySelectorAll(".nav a"));
  var here = (location.pathname.split("/").pop() || "index.html");
  var sectionLinks = navLinks.filter(function(a){
    return (a.getAttribute("href") || "").indexOf("#") === 0;
  });
  var pageLink = navLinks.filter(function(a){
    return (a.getAttribute("href") || "") === here;
  })[0];
  var lockUntil = 0;

  function setActive(link){
    navLinks.forEach(function(a){
      var on = a === link;
      a.classList.toggle("is-active", on);
      if(on){ a.setAttribute("aria-current", "true"); }
      else { a.removeAttribute("aria-current"); }
    });
  }

  function syncActive(){
    if(!sectionLinks.length || Date.now() < lockUntil){ return; }
    /* The section that owns the most of the screen wins, measured below the
       header. Anchoring on "which section top has scrolled past" instead would
       favour tall sections and leave a short one highlighted for a moment. */
    var top = header.offsetHeight;
    var bottom = window.innerHeight;
    var best = null;
    var bestVisible = 0;
    sectionLinks.forEach(function(link){
      var section = document.getElementById(link.getAttribute("href").slice(1));
      if(!section){ return; }
      var box = section.getBoundingClientRect();
      var visible = Math.min(box.bottom, bottom) - Math.max(box.top, top);
      /* strict >, so when two sections show the same amount of screen the one
         higher up wins. With >= a tie handed the highlight to the last link,
         which is how Contact could light up while the hero was still on screen. */
      if(visible > bestVisible){ bestVisible = visible; best = link; }
    });
    if(bestVisible <= 0){ best = null; }
    setActive(best);
  }

  if(pageLink && !sectionLinks.length){ setActive(pageLink); }
  /* only the section links take the highlight. The CV button downloads a file
     and never becomes "where you are", so clicking it must not steal the
     highlight or freeze the scroll spy behind it. */
  sectionLinks.forEach(function(link){
    link.addEventListener("click", function(){
      setActive(link);
      /* hold the choice while the smooth scroll travels, then let the page decide */
      lockUntil = Date.now() + 900;
    });
  });
  window.addEventListener("scroll", syncActive, { passive:true });
  window.addEventListener("resize", syncActive);
  /* the first measurement happens before images and web fonts change the
     heights, so take it again once they have */
  window.addEventListener("load", syncActive);
  if(document.fonts && document.fonts.ready && document.fonts.ready.then){
    document.fonts.ready.then(syncActive)["catch"](function(){});
  }
  syncActive();

  /* reveal on scroll */
  var revealables = document.querySelectorAll(".reveal");
  if(reduce || !("IntersectionObserver" in window)){
    revealables.forEach(function(el){ el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold:.15, rootMargin:"0px 0px -40px 0px" });
    revealables.forEach(function(el){ revealObserver.observe(el); });
  }

  /* skill bars fill when the grid comes into view */
  var grid = document.getElementById("skillsGrid");
  function fillBars(){
    document.querySelectorAll(".bar span").forEach(function(bar){
      bar.style.width = bar.getAttribute("data-level") + "%";
    });
  }
  if(!grid){
    /* no skills section on this page */
  } else if(reduce || !("IntersectionObserver" in window)){
    fillBars();
  } else {
    var barObserver = new IntersectionObserver(function(entries, obs){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ fillBars(); obs.disconnect(); }
      });
    }, { threshold:.3 });
    barObserver.observe(grid);
  }

  /* hero run sequence, the one orchestrated moment on the page */
  var lines = document.querySelectorAll("#run .run-line");
  var foot = document.getElementById("runFoot");
  if(!lines.length || !foot){
    /* no run panel on this page */
  } else if(reduce){
    lines.forEach(function(l){ l.classList.add("on"); });
    foot.classList.add("on");
  } else {
    lines.forEach(function(line, i){
      setTimeout(function(){ line.classList.add("on"); }, 380 + i * 260);
    });
    setTimeout(function(){ foot.classList.add("on"); }, 380 + lines.length * 260 + 160);
  }

  /* Footer icons. The LinkedIn and GitHub marks are their trademarks, so they
     are not drawn here. Drop the official SVGs into assets/img and they appear;
     until then the label stands on its own instead of a broken image. */
  /* A masked icon cannot report a missing file: an absent mask hides everything
     and the link would go blank. So the file is checked first, and only a file
     that actually loaded is allowed to replace the word. */
  [].slice.call(document.querySelectorAll(".social-icon[data-src]")).forEach(function(span){
    var link = span.parentNode;
    var probe = new Image();
    probe.onload = function(){ if(link){ link.classList.add("has-icon"); } };
    probe.src = span.getAttribute("data-src");
  });

  /* expandable lists */
  /* The arrow is wrapped so it can move on its own: a label that says "show
     more" is more convincing when its arrow leans the way the list will go. */
  function label(text, arrow){
    return text + ' <span class="more-arrow">' + arrow + "</span>";
  }
  function wireToggle(btnId, listId, moreText, lessText){
    var btn = document.getElementById(btnId);
    var list = document.getElementById(listId);
    if(!btn || !list){ return; }
    btn.innerHTML = label(moreText, "\u2193");
    btn.addEventListener("click", function(){
      var open = list.classList.toggle("is-expanded");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.classList.toggle("is-open", open);
      btn.innerHTML = open ? label(lessText, "\u2191") : label(moreText, "\u2193");
    });
  }
  wireToggle("moreTimeline", "timeline", "Show the earlier roles", "Show fewer roles");
  wireToggle("moreCerts", "certPills", "Show all certifications listed here", "Show fewer certifications");
  wireToggle("moreForm", "formPanel", "Prefer to write here? Open the contact form", "Close the contact form");

  /* contact form: validate, then hand off to the email client */
  var form = document.getElementById("contactForm");
  var status = document.getElementById("formStatus");
  if(!form){ return; }
  var submitBtn = form.querySelector("button[type=submit]");
  var sending = false;
  function setInvalid(id, invalid){
    var field = document.getElementById(id).closest(".field");
    field.classList.toggle("invalid", invalid);
    return !invalid;
  }
  ["name","email","subject","message"].forEach(function(id){
    var el = document.getElementById(id);
    el.addEventListener("input", function(){ el.closest(".field").classList.remove("invalid"); });
    el.addEventListener("change", function(){ el.closest(".field").classList.remove("invalid"); });
  });
  form.addEventListener("submit", function(e){
    e.preventDefault();
    /* One handover at a time. A double click, an Enter key held down or a second
       tab submitting the same form cannot fire two mailto handovers at once. */
    if(sending){ return; }
    var name = document.getElementById("name").value.trim();
    var email = document.getElementById("email").value.trim();
    var subject = document.getElementById("subject").value;
    var message = document.getElementById("message").value.trim();
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

    var ok = true;
    ok = setInvalid("name", name.length < 2) && ok;
    ok = setInvalid("email", !emailOk) && ok;
    ok = setInvalid("subject", subject === "") && ok;
    ok = setInvalid("message", message.length < 10) && ok;
    if(!ok){
      status.classList.remove("on");
      form.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea").focus();
      return;
    }

    var body = message + "\n\n" + name + "\n" + email;
    var href = "mailto:emanuela.telescu@yahoo.com"
      + "?subject=" + encodeURIComponent(subject + " enquiry from " + name)
      + "&body=" + encodeURIComponent(body);
    sending = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Opening your email app";
    status.classList.add("on");
    window.location.href = href;

    setTimeout(function(){
      sending = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Send message";
    }, 4000);
  });
})();
