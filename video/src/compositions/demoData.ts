import type { CodeRevealProps, Cue, TerminalProps } from "../components";

// 示例数据：取自第 2 期「服务器告警机器人」
export const alertBotCode: CodeRevealProps = {
  filename: "alert_bot.py",
  language: "python",
  highlightLines: [10, 11, 12],
  code: `
import psutil, requests

WEBHOOK = "https://open.feishu.cn/xxx"
LIMIT = {"cpu": 90, "mem": 85, "disk": 90}

def check():
    cpu = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory().percent
    disk = psutil.disk_usage("/").percent
    for name, val in {"cpu": cpu, "mem": mem, "disk": disk}.items():
        if val > LIMIT[name]:
            alert(f"⚠ {name} 使用率 {val}%")

def alert(msg):
    requests.post(WEBHOOK, json={"msg_type": "text", "content": {"text": msg}})

if __name__ == "__main__":
    check()
`,
};

export const alertBotTerminal: TerminalProps = {
  title: "root@web-03",
  lines: [
    { type: "cmd", text: "pip install psutil requests" },
    { type: "out", text: "Successfully installed psutil-6.1.0 requests-2.32.3", color: "muted" },
    { type: "cmd", text: "python alert_bot.py" },
    { type: "out", text: "[check] cpu=97.3% mem=62.1% disk=41.0%" },
    { type: "out", text: "[alert] ⚠ cpu 使用率 97.3% → 已推送到飞书", color: "warning" },
    { type: "cmd", text: "crontab -l | grep alert_bot" },
    { type: "out", text: "* * * * * python3 /opt/alert_bot.py", color: "muted" },
    { type: "out", text: "✔ 已设置每分钟巡检一次", color: "success" },
  ],
};

export const demoCues: Cue[] = [
  { start: 0.3, end: 2.5, text: "服务器出问题了，没人知道怎么办？" },
  { start: 2.5, end: 5, text: "30 分钟，用 AI 写一个告警机器人" },
];
