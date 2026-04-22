async function loadTSStatus() {
  const dot = document.getElementById("ts-dot");
  const text = document.getElementById("ts-text");
  const users = document.getElementById("ts-users-count");

  if (!dot || !text || !users) return;

  // حالت اولیه = در حال بررسی
  dot.className = "ts-dot loading";
  text.textContent = "درحال بررسی...";
  users.textContent = "loading...";

  try {
    const res = await fetch("https://ts.nox-rp.ir/api/ts-status", {
      cache: "no-store",
    });

    const data = await res.json();

    if (!data.online) {
      dot.className = "ts-dot offline"; // قرمز
      text.textContent = "آفلاین";
      users.textContent = "0";
      return;
    }

    dot.className = "ts-dot online"; // سبز
    text.textContent = "آنلاین";
    users.textContent = data.users || 0;
  } catch (err) {
    dot.className = "ts-dot offline"; // قرمز
    text.textContent = "اتصال برقرار نشد";
    users.textContent = "--";

    console.error("TS Status Error:", err);
  }
}

loadTSStatus();
setInterval(loadTSStatus, 10000);
