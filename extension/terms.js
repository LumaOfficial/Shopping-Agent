// The terms document is static, so the only script is navigation: the contents
// list marks the section you are reading, which is what makes a long document
// easy to move around in. Nothing here reads or stores anything.
const links = Array.from(document.querySelectorAll(".terms-toc a[href^='#']"));
const sections = links
  .map((link) => document.getElementById(link.getAttribute("href").slice(1)))
  .filter(Boolean);

function markCurrent() {
  const fromTop = window.scrollY + 120;
  let current = sections[0];
  sections.forEach((section) => {
    if (section.offsetTop <= fromTop) current = section;
  });
  links.forEach((link) => {
    const on = current && link.getAttribute("href") === "#" + current.id;
    if (on) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

window.addEventListener("scroll", markCurrent, { passive: true });
markCurrent();
