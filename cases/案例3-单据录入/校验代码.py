# Dify「代码执行」节点（Python 3）
# 输入变量：text（选 LLM 节点的 text）
# 输出变量：result（String）、status（String）
import json


def num(v):
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "").replace("¥", ""))
    except ValueError:
        return None


def main(text: str) -> dict:
    s = text[text.find("{"): text.rfind("}") + 1]  # 去掉 AI 可能多写的 ```json
    data = json.loads(s)
    problems = []

    for k in ["单据类型", "单号", "日期", "供应商"]:
        if not data.get(k):
            problems.append(f"缺少「{k}」")

    total = 0
    for i, item in enumerate(data.get("明细") or [], 1):
        q, p, a = num(item.get("数量")), num(item.get("单价")), num(item.get("金额"))
        if None in (q, p, a):
            problems.append(f"第 {i} 行缺数量、单价或金额")
            continue
        total += a
        if abs(q * p - a) > 0.01:
            problems.append(f"第 {i} 行 {item.get('品名')}：{q:g} × {p:g} = {q * p:.2f}，单据写的是 {a:.2f}")

    t = num(data.get("合计金额"))
    if t is not None and abs(total - t) > 0.01:
        problems.append(f"明细加起来 {total:.2f}，合计写的是 {t:.2f}")

    status = "通过" if not problems else "需人工复核"
    data["校验"] = status if not problems else status + "：" + "；".join(problems)
    return {"result": json.dumps(data, ensure_ascii=False, indent=2), "status": status}
