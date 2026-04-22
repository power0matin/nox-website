import express from "express";
import dgram from "dgram"; // برای پینگ UDP TS3

const app = express();
const PORT = 3001;

// آدرس TeamSpeak شما
const TS_HOST = "ts.nox-rp.ir";
const TS_PORT = 9987; // پورت پیش‌فرض صوتی TeamSpeak

// پینگ UDP — اگر جواب داد یعنی سرور آنلاین است
function pingTeamSpeak() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");

    const msg = Buffer.from("TS3INIT1"); // پیام استاندارد پینگ TS

    let responded = false;

    socket.send(msg, 0, msg.length, TS_PORT, TS_HOST, () => {
      // منتظر پاسخ می‌مانیم
    });

    socket.on("message", () => {
      responded = true;
      socket.close();
      resolve(true); // ONLINE
    });

    socket.on("error", () => {
      socket.close();
      resolve(false);
    });

    // اگر 1.5 ثانیه گذشت و پاسخی نبود = Offline
    setTimeout(() => {
      if (!responded) {
        socket.close();
        resolve(false); // OFFLINE
      }
    }, 2000);
  });
}

// API Endpoint
app.get("/api/ts-status", async (req, res) => {
  const online = await pingTeamSpeak();

  if (!online) {
    return res.json({
      online: false,
      users: 0,
    });
  }

  // اگر بخواهی اطلاعات حرفه‌ای‌تر بگیری باید "ServerQuery" داشته باشی.
  // چون گفتی دسترسی نداری → فقط وضعیت واقعی + امکان‌شماری نداریم.

  res.json({
    online: true,
    users: 0, // بدون دسترسی ServerQuery امکان دریافت آنلاین‌ها نیست
  });
});

app.listen(PORT, () =>
  console.log(`TS Status API running at http://localhost:${PORT}`),
);
