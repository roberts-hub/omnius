// ── comparador antes/después ──
    document.querySelectorAll("[data-comparador]").forEach((comp) => {
      const mover = (clientX) => {
        const r = comp.getBoundingClientRect();
        const x = Math.min(Math.max(clientX - r.left, 0), r.width);
        comp.style.setProperty("--x", (x / r.width) * 100 + "%");
      };
      comp.addEventListener("pointerdown", (e) => {
        comp.setPointerCapture(e.pointerId);
        mover(e.clientX);
        const onMove = (ev) => mover(ev.clientX);
        const fin = () => {
          comp.removeEventListener("pointermove", onMove);
          comp.removeEventListener("pointerup", fin);
        };
        comp.addEventListener("pointermove", onMove);
        comp.addEventListener("pointerup", fin);
      });
    });

    // ── FAQ ──
    document.querySelectorAll(".faq-q").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".faq-item");
        const abierto = item.classList.toggle("abierto");
        const resp = item.querySelector(".faq-a");
        resp.style.maxHeight = abierto ? resp.scrollHeight + "px" : "0";
      });
    });

    // ── reveal on scroll ──
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visto")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
