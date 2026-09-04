(function(){
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* header state + sticky cta */
  var header = document.getElementById("siteHeader");
  var cta = document.getElementById("stickyCta");
  function onScroll(){
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if(header){ header.classList.toggle("is-stuck", y > 24); }
    if(cta){ cta.classList.toggle("on", y > 640); }
  }
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();

  /* smooth scroll that survives sandboxed iframes */
  document.querySelectorAll('a[href^="#"]').forEach(function(link){
    link.addEventListener("click", function(e){
      var id = link.getAttribute("href").slice(1);
      if(!id){ return; }
      var target = document.getElementById(id);
      if(target){
        e.preventDefault();
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block:"start" });
        try{ if(history.pushState){ history.pushState(null, "", "#" + id); } }catch(err){}
      }
    });
  });

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

  /* expandable lists */
  function wireToggle(btnId, listId, moreText, lessText){
    var btn = document.getElementById(btnId);
    var list = document.getElementById(listId);
    if(!btn || !list){ return; }
    btn.addEventListener("click", function(){
      var open = list.classList.toggle("is-expanded");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.innerHTML = open ? lessText : moreText;
    });
  }
  wireToggle("moreTimeline", "timeline", "Show the earlier roles &darr;", "Show fewer roles &uarr;");
  wireToggle("morePills", "pills", "Show the full stack &darr;", "Show fewer tools &uarr;");
  wireToggle("moreCerts", "certPills", "Show all certifications listed here &darr;", "Show fewer certifications &uarr;");
  wireToggle("moreForm", "formPanel", "Prefer to write here? Open the contact form &darr;", "Close the contact form &uarr;");

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
