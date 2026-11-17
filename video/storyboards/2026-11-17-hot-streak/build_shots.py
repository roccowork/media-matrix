"""《天才不是一种人，是一段时间》逐镜配置生成器。

按配音的实际时长（public/voice/2026-11-17-hot-streak/voice.json）算每镜秒数，写出 shots/NN.json（每镜一个完整 ShotConfig）。
改了配音或镜头设计后重跑：python3 storyboards/2026-11-17-hot-streak/build_shots.py（在 video/ 下）
全片主视觉：资产 life.lifelines.v1「人生光河」（《方案补充》#36）。
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent.parent
VOICE = json.loads((VIDEO / 'public/voice/2026-11-17-hot-streak/voice.json').read_text(encoding='utf-8'))
DUR = {x['i']: x['dur'] for x in VOICE['lines']}
SAY = {x['i']: x['say'] for x in VOICE['lines']}
SEED = '2026-11-17-hot-streak'
L = 60
GAP = 0.6  # 每句话后留的气口
LEAD = 0.8  # 每镜开头先给画面的时间（第一句话从这里开始念）

POST_GLOW = {'bloom': {'intensity': 0.9, 'threshold': 0.6, 'radius': 0.55}, 'tone': 'aces', 'grain': 0.014}  # 不加暗角：背景光河和暗角一起会出怪光斑
POST_RIVER = {'tone': 'aces', 'grain': 0.014}  # 光河镜头：不加辉光、不加暗角（踩坑：暗角和几千条加色细线一起出怪光斑）


def hx(s):
    """主角线上 s 处的 x 坐标（y、z 约为 0）"""
    return (s - 0.5) * L


def k(t, pos, look, fov=40, roll=0):
    return {'t': round(t, 3), 'pos': [round(v, 3) for v in pos], 'look': [round(v, 3) for v in look], 'fov': fov, 'roll': roll}


def life(**p):
    base = {'seed': SEED, 'heroWidth': 0.03, 'heroDim': 0.5, 'count': 0}
    base.update(p)
    return {'id': 'life.lifelines.v1', 'params': base}


def length(lines, extra=0.0):
    return round(LEAD * 0.5 + sum(DUR[i] for i in lines) + GAP * len(lines) + extra, 2)


SHOTS = []


def bg(y=-8.0, z=-24.0, dim=0.035):
    return {'id': 'life.lifelines.v1', 'params': {'seed': SEED + '-bg', 'hero': False, 'dust': 0, 'count': 5000, 'position': [0, y, z],
            'spreadZ': 26, 'spreadY': 4, 'riverAt': 0, 'riverDuration': 0.1, 'riverDim': dim, 'streakAt': 0, 'streakSpread': 60,
            'streakGain': 0.5, 'fogDist': 16, 'timeOffset': 20}}


def shot(lines, visual, keys, assets, post=POST_GLOW, extra=0.0, onscreen=None, note=None, transition=None, nobg=False):
    d = length(lines, extra)
    # 最后一个关键帧补到结尾
    if keys[-1]['t'] < d:
        last = dict(keys[-1]); last['t'] = d; keys = keys + [last]
    if post is POST_GLOW and not nobg and not any(a['params'].get('count', 0) for a in assets):
        assets = assets + [bg()]
    cfg = {'id': 'life.lifelines.v1', 'renderer': 'threejs', 'style': 'cinematic_science', 'fps': 30, 'duration': d,
           'camera': {'preset': 'keys', 'keys': keys}, 'post': post, 'assets': assets, 'version': '1.0.0'}
    s = {'n': len(SHOTS) + 1, 'lines': lines, 'narration': ''.join(SAY[i] for i in lines), 'visual': visual, 'config': cfg}
    if onscreen: s['onscreen'] = onscreen
    if note: s['note'] = note
    if transition: s['transition'] = transition
    SHOTS.append(s)
    return d


# ---------- 一、钩子 ----------
# 1 金线从黑暗中长出，镜头追线头
def smooth(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)


d1 = length([1], extra=0.6)
keys = []
for i in range(11):
    t = d1 * i / 10
    tip = -L / 2 + L * smooth((t - 0.1) / (d1 - 0.5))
    a = t / d1
    keys.append(k(t, [tip - 2.2 - 6 * a ** 2, 0.35 + 1.4 * a ** 2, 1.3 + 9 * a ** 2], [tip + 1.5 - a, 0, 0], 44, round(-8 + 6 * a, 2)))
shot([1], '黑暗中一条金线像彗星一样从左往右长出，镜头贴着线头追，最后拉到侧面', keys,
     [life(drawAt=0.1, drawDuration=d1 - 0.5, heroDim=0.5, heroWidth=0.022)], extra=0.6)

# 2 大部分日子是暗的：贴着暗线缓慢平移
shot([2], '镜头贴着整条暗着的线缓慢平移，线像冷掉的余烬', [k(0, [hx(0.15), 0.5, 3.2], [hx(0.25), 0, 0], 42, -4), k(3.2, [hx(0.35), 0.4, 2.6], [hx(0.47), 0, 0], 42, -2)],
     [life(heroDim=0.45, dust=2000)])

# 3 突然亮了：点燃 + 火花
d3 = shot([3], '整条线还暗着，中段四五年突然从中心烧亮，火花迸射', [k(0, [-2.2, 0.45, 1.9], [5, 0.05, -0.6], 48, -7), k(3.8, [-0.6, 0.7, 2.6], [4.5, 0.2, -0.4], 46, -3)],
          [life(heroIgniteAt=0.5, heroDim=0.45)], extra=0.6)

# 4 一件比一件好：年份刻度亮起，高光段里的刻度跟着烧亮
shot([4], '镜头沿高光段滑过，年份刻度一格格亮起，高光段里的刻度被烧亮', [k(0, [hx(0.47), 0.8, 2.4], [hx(0.53), 0, 0], 40, -3), k(3.6, [hx(0.6), 0.9, 2.6], [hx(0.62), 0, 0], 40, 2)],
     [life(heroIgniteAt=0.5, timeOffset=d3, ticksAt=d3 - 1.2, heroDim=0.45, sparks=0)])

# 5 我们管这样的人叫天才 → 可科学家发现：天才不是一种人，是一段时间
shot([5, 6], '镜头后拉，看到亮着的只是整条线上的一段；年份刻度铺满一生', [k(0, [hx(0.55), 0.8, 3], [hx(0.55), 0, 0], 40, 0), k(3.0, [hx(0.55), 2.0, 12], [hx(0.5), 0, 0], 44, 0), k(7.6, [hx(0.5), 3.0, 30], [hx(0.5), 0, 0], 46, 0)],
     [life(heroIgniteAt=0.1, timeOffset=8, ticksAt=0, heroDim=0.45, sparks=0, heroWidth=0.04)],
     onscreen={'text': '天才不是一种人，是一段时间', 'style': 'title', 'position': 'top'})

# ---------- 二、证据 ----------
# 6 两万多人的一生：急速后拉成光河
d6 = shot([7], '镜头从主角线急速后拉升高：两万条人生线铺成一条光河，从中心一圈圈亮起', [k(0, [1, 0.5, 4], [3, 0, 0], 40, 0), k(1.4, [2, 4, 15], [2, 0, 0], 44, -2), k(5.4, [-12, 24, 34], [2, -2, 0], 48, -5)],
          [life(heroIgniteAt=0, timeOffset=4, count=20000, riverAt=4.3, riverDuration=2.2, spreadZ=26, spreadY=3.5, riverDim=0.06, streakGain=0.6, heroWidth=0.05)], post=POST_RIVER)

# 7 不只是名人：几十条名人线整条亮着，其余是暗的普通人
shot([8], '俯看光河：几十条整条发亮的「名人线」，周围是两万条暗着的普通人的一生', [k(0, [-12, 24, 34], [2, -2, 0], 48, -5), k(4, [-4, 30, 26], [0, -2, -2], 50, -3)],
     [life(hero=False, count=20000, riverAt=0, riverDuration=0.1, spreadZ=26, spreadY=3.5, riverDim=0.04, famous=60, famousGain=450, timeOffset=20)], post=POST_RIVER)

# 8 AI 读完每个人：一道扫描光带从左扫到右
shot([9], '镜头低飞掠过河面，一道白色扫描光带从左扫到右，扫过的人生线留下余辉', [k(0, [hx(0.05), 3, 18], [hx(0.3), 0, 0], 46, -6), k(4.6, [hx(0.6), 3.5, 18], [hx(0.85), 0, 0], 46, -2)],
     [life(hero=False, count=20000, riverAt=0, riverDuration=0.1, spreadZ=26, spreadY=3.5, riverDim=0.05, scanAt=0.3, scanDuration=3.8, timeOffset=20)], post=POST_RIVER)

# 9 大多数人的一生里都藏着高光期：河面各处陆续点燃
shot([10], '高处俯看：河面上一段段高光期接连点燃，像夜里一片片亮起的灯', [k(0, [-2, 34, 30], [0, -2, -3], 50, -4), k(5.9, [6, 30, 24], [0, -2, -3], 48, -2)],
     [life(hero=False, count=20000, riverAt=0, riverDuration=0.1, spreadZ=26, spreadY=3.5, riverDim=0.04, streakAt=0.4, streakSpread=4.5, streakGain=0.7, timeOffset=20)], post=POST_RIVER)

# 10 平均四五年：贴近一条线，四五个年份刻度被高光段罩住
shot([11], '贴近一条人生线：高光段正好罩住四五个年份刻度，火花从这几年里迸出', [k(0, [hx(0.48), 0.6, 2.2], [hx(0.55), 0, 0], 40, -3), k(4.4, [hx(0.53), 0.7, 2.0], [hx(0.58), 0, 0], 40, 1)],
     [life(heroIgniteAt=0.4, ticksAt=0, timeOffset=0, heroDim=0.45, sparks=500)])

# 11 什么时候来几乎随机：侧看光河，亮段东一个西一个
shot([12], '侧看光河：亮着的高光段东一个西一个，位置毫无规律', [k(0, [hx(0.0), 6, 30], [hx(0.4), 0, 0], 44, -3), k(4.5, [hx(0.25), 6, 28], [hx(0.6), 0, 0], 44, -1)],
     [life(hero=False, count=8000, riverAt=0, riverDuration=0.1, spreadZ=14, spreadY=6, riverDim=0.05, streakAt=2, streakSpread=4.0, streakGain=0.9, timeOffset=2)], post=POST_RIVER)

# 12 有人刚入行就来了，有人干了很多年才等到：两条线一早一晚
shot([13], '上下两条人生线：上面那条刚开头就亮了，下面那条快到尽头才亮', [k(0, [0, 0.6, 38], [0, 0, 0], 48, -2), k(4.0, [0, 0.6, 33], [0, 0, 0], 48, 0)],
     [life(position=[0, 2.0, 0], heroStreak=0.14, heroIgniteAt=0.5, heroWidth=0.09, heroDim=0.7, sparks=500, dust=800),
      life(position=[0, -2.0, 0], heroStreak=0.84, heroIgniteAt=2.2, heroWidth=0.09, heroDim=0.7, sparks=500, dust=0, seed=SEED + '-b')])

# ---------- 三、转折 ----------
# 13 所以真正的问题……接不接得住：「现在」标记 + 前方待点燃的暖光
shot([14, 15], '回到你那条线：「现在」的位置一个光点在闪，前方不远处有一段在隐隐发热，还没点燃', [k(0, [hx(0.26), 1.8, 10], [hx(0.46), 0, 0], 42, -3), k(7.6, [hx(0.3), 1.3, 7.5], [hx(0.5), 0, 0], 42, -1)],
     [life(nowAt=0.4, pending=0.9, heroStreak=0.58, heroDim=0.45)],
     onscreen={'text': '你接不接得住？', 'style': 'title', 'position': 'top'})

# 14 科学家在高光期前面找到同一个前兆：镜头沿线往回倒
shot([16], '镜头沿线往回倒，停在高光段起点之前，那里的线开始冒出细细的分叉', [k(0, [hx(0.56), 0.8, 3], [hx(0.5), 0, 0], 42, 2), k(4.3, [hx(0.32), 1.2, 4.2], [hx(0.4), 0, 0], 44, -2)],
     [life(pending=0.6, heroStreak=0.58, branches=6, branchStart=0.3, exploreAt=2.2, exploreDuration=4, branchSpread=1.2)])

# ---------- 四、前兆：先试，再收 ----------
EXP = dict(heroStreak=0.6, branchStart=0.28, branches=36, branchSpread=2.6, exploreAt=0.0, exploreDuration=5.5)
# 15 第一个动作：乱试
d15 = shot([17], '线的前端像树根一样分叉，四处乱钻', [k(0, [hx(0.33), 1.6, 6.5], [hx(0.4), 0, 0], 46, -4), k(3.0, [hx(0.36), 2.2, 8], [hx(0.42), 0, 0], 46, -2)],
           [life(**EXP)], extra=0.4)
# 16 东一榔头西一棒子
d16 = shot([18], '分叉越来越多、越钻越远，每个分叉尖都闪着光，方向各不相同', [k(0, [hx(0.36), 2.2, 8], [hx(0.42), 0, 0], 46, -2), k(7.3, [hx(0.46), 3.5, 11], [hx(0.44), 0, 0], 48, 2)],
           [life(**EXP, timeOffset=d15)])
# 17 在外人看来，这叫不专一、瞎折腾
d17 = shot([19], '一团乱麻似的分叉在原地打转，看不出往哪走', [k(0, [hx(0.5), 1.2, 6], [hx(0.42), 0, 0], 44, 3), k(3.4, [hx(0.48), 1.0, 5.2], [hx(0.42), 0, 0], 44, 1)],
           [life(**EXP, timeOffset=d15 + d16)])
T0 = d15 + d16 + d17
# 18 第二个动作：收
d18 = shot([20, 21], '所有分叉突然停住，从汇合点一端开始收紧，拧成一股光束', [k(0, [hx(0.42), 2.6, 9], [hx(0.44), 0, 0], 46, 0), k(6.7, [hx(0.5), 1.2, 5], [hx(0.58), 0, 0], 42, -2)],
           [life(**EXP, timeOffset=T0, convergeAt=T0 + 2.2, convergeDuration=3.2)])
# 19 紧接着，高光期就来了
shot([22], '光束射到尽头，高光段轰然点燃，火花冲天', [k(0, [hx(0.53), 0.5, 2.6], [hx(0.62), 0.1, -0.3], 46, -6), k(4.2, [hx(0.56), 0.9, 3.6], [hx(0.62), 0.2, 0], 46, -2)],
     [life(**EXP, timeOffset=T0 + d18, convergeAt=T0 + 2.2, convergeDuration=3.2, heroIgniteAt=T0 + d18 + 0.5, sparks=1400)], extra=1.4)

# ---------- 五、对照：缺一不可 ----------
A = dict(heroStreak=0.6, heroDim=0.4, dust=0)
ROW = {'wild': [0, 3.2, 0], 'straight': [0, -3.2, 0], 'both': [0, 0, 0]}
# 20 两个动作缺一不可：三条线并排
shot([23], '镜头升高，并排出现三条人生线', [k(0, [0, 1, 14], [0, 0, 0], 44, 0), k(3.1, [0, 2, 26], [0, 0, 0], 46, 0)],
     [life(position=ROW['wild'], **A, seed=SEED + '-w'), life(position=ROW['both'], **A, seed=SEED + '-c'), life(position=ROW['straight'], **A, seed=SEED + '-s')])
# 21 只乱试不收：上面那条一直乱长，始终没亮，慢慢熄灭
shot([24], '上面那条一直乱长、从不收拢，高光段始终没亮，分叉慢慢熄灭', [k(0, [0, 4.2, 14], [0, 3.2, 0], 44, 0), k(4.4, [-2, 4.5, 12], [0, 3.2, 0], 44, 0)],
     [life(position=ROW['wild'], **A, branches=30, branchStart=0.2, branchSpread=1.3, exploreAt=0, exploreDuration=2.5, branchFadeAt=2.6, seed=SEED + '-w'),
      life(position=ROW['both'], **A, seed=SEED + '-c'), life(position=ROW['straight'], **A, seed=SEED + '-s')])
# 22 只死磕不试：下面那条一根直线走到底，没有亮
shot([25], '下面那条从头到尾一根直线，一直平着走，没有亮起', [k(0, [-12, -2.2, 12], [0, -3.2, 0], 44, 0), k(4.1, [8, -2.4, 12], [10, -3.2, 0], 44, 0)],
     [life(position=ROW['wild'], **A, seed=SEED + '-w'), life(position=ROW['both'], **A, seed=SEED + '-c'),
      life(position=ROW['straight'], **A, drawAt=0, drawDuration=3.6, seed=SEED + '-s')])
# 23 只有先试再收：中间那条先乱试再收，接着点燃
shot([26], '中间那条先四处乱试，再拧成一束，紧接着高光段点燃', [k(0, [0, 1, 16], [0, 0, 0], 46, 0), k(4.4, [2, 0.8, 12], [4, 0, 0], 44, 0)],
     [life(position=ROW['wild'], **A, seed=SEED + '-w'),
      life(position=ROW['both'], **A, branches=30, branchStart=0.2, branchSpread=1.3, exploreAt=0, exploreDuration=1.6, convergeAt=1.5, convergeDuration=1.4, heroIgniteAt=3.0, sparks=700, seed=SEED + '-c'),
      life(position=ROW['straight'], **A, seed=SEED + '-s')])

# ---------- 六、自测：你在哪一格 ----------
QL = 22  # 每格里那条线的长度
Q = {'ll': [-13, -6, 0], 'lr': [13, -6, 0], 'ul': [-13, 6, 0], 'ur': [13, 6, 0]}
qa = dict(length=QL, heroDim=0.7, dust=0, heroStreak=0.7, heroStreakLen=0.14, heroWidth=0.08)
QUAD = [
    life(position=Q['ll'], **qa, seed=SEED + '-q1'),  # 试得少，没收：原地
    life(position=Q['lr'], **qa, branches=24, branchStart=0.15, branchEnd=0.6, branchSpread=1.6, exploreAt=1, exploreDuration=3, timeOffset=10, seed=SEED + '-q2'),  # 一直试，没收
    life(position=Q['ul'], **{**qa, 'heroDim': 0.7}, seed=SEED + '-q3'),  # 早早就收：一根直线
    life(position=Q['ur'], **qa, branches=24, branchStart=0.15, branchEnd=0.6, branchSpread=1.6, exploreAt=1, exploreDuration=3, convergeAt=5, convergeDuration=2, timeOffset=10, pending=1.0, seed=SEED + '-q4'),  # 试过也收了
]
shot([27], '四条线排成 2×2 四格：左下一条短暗线、右下乱成一团、左上一根直线、右上分叉已收拢、前方发热', [k(0, [0, 0, 52], [0, 0, 0], 44, 0), k(3.4, [0, 0, 44], [0, 0, 0], 44, 0)], QUAD,
     onscreen={'text': '你现在在哪一格？', 'style': 'title', 'position': 'center'}, nobg=True)
for line, key, desc, txt in [(28, 'll', '镜头推向左下格：一条短暗线，没有分叉', '试得少，也没收'), (29, 'lr', '镜头推向右下格：分叉乱成一团，一直在打转', '一直在试，从来没收'),
                             (30, 'ul', '镜头推向左上格：一根直线，周围一片漆黑', '早早就收，没怎么试过'), (31, 'ur', '镜头推向右上格：分叉已拧成一束，前方那段在发热', '试过了，也收了')]:
    c = Q[key]
    shot([line], desc, [k(0, [c[0] * 0.5, c[1] * 0.5, 50], [c[0] * 0.6, c[1] * 0.6, 0], 40, 0), k(2.2, [c[0], c[1] + 1, 15], [c[0], c[1], 0], 44, -2)], QUAD,
         onscreen={'text': txt, 'style': 'caption', 'position': 'top'}, nobg=True)

# ---------- 七、收尾 ----------
# 29 试多久才算够，还没有答案：分叉还在慢慢长
shot([32], '一条线的分叉还在慢慢长、慢慢试，没有尽头', [k(0, [hx(0.3), 2, 7], [hx(0.35), 0, 0], 46, -2), k(4.6, [hx(0.36), 2.4, 8], [hx(0.4), 0, 0], 46, 0)],
     [life(heroStreak=0.6, branchStart=0.25, branches=20, branchSpread=2.0, exploreAt=0, exploreDuration=9)])
# 30 但至少我们知道了——天才不是一种人
shot([33, 34], '回到开头那条一生的线，镜头缓缓推近', [k(0, [0, 1.6, 30], [0, 0, 0], 42, 0), k(4.6, [hx(0.42), 0.9, 6], [hx(0.48), 0, 0], 42, -2)],
     [life(nowAt=0.42, heroStreak=0.6, heroDim=0.5)], onscreen={'text': '天才不是一种人', 'style': 'title', 'position': 'top'})
# 31 是你一生中被你自己接住的那四五年：前方那段缓缓点燃 → 拉远回到光河
shot([35], '「现在」前方的那一段缓缓点燃；镜头拉远，你的线回到两万条人生汇成的光河里', [k(0, [hx(0.48), 0.9, 6], [hx(0.55), 0, 0], 42, -2), k(2.6, [hx(0.55), 3, 16], [hx(0.55), 0, 0], 44, -2), k(6.6, [-6, 22, 40], [2, -2, 0], 48, -4)],
     [life(nowAt=0.42, heroStreak=0.6, heroIgniteAt=0.8, heroIgniteDuration=1.6, sparks=900, count=20000, riverAt=2.4, riverDuration=2.5, spreadZ=26, spreadY=3.5, riverDim=0.05, streakAt=3.2, streakSpread=3, streakGain=0.6, heroWidth=0.05)],
     post=POST_RIVER, extra=3.0, onscreen={'text': '是你接住的那四五年', 'style': 'title', 'position': 'top'})

out = HERE / 'shots'
out.mkdir(exist_ok=True)
for p in out.glob('*.json'):
    p.unlink()
total = 0.0
for s in SHOTS:
    (out / f"{s['n']:02d}.json").write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding='utf-8')
    total += s['config']['duration']
print(f'{len(SHOTS)} 镜，共 {total:.1f} 秒（{int(total // 60)} 分 {total % 60:.0f} 秒）')

# ---------- 整条分镜：拼镜头 + 放配音 ----------
voice, t = [], 0.0
for s in SHOTS:
    at = t + LEAD * 0.5
    for i in s['lines']:
        f = next(x['file'] for x in VOICE['lines'] if x['i'] == i)
        voice.append({'src': f'voice/2026-11-17-hot-streak/{f}', 'at': round(at, 3), 'dur': DUR[i], 'text': SAY[i]})
        at += DUR[i] + GAP
    t += s['config']['duration']
sb = {
    'id': '2026-11-17-hot-streak', 'topic': '成功的科学 · 第 1 集：天才不是一种人，是一段时间', 'title': '天才不是一种人，是一段时间', 'fps': 30,
    'generator': {'by': 'hand', 'date': '2026-11-17'},
    'limits': {'maxShot': 13, 'minTotal': 140, 'maxTotal': 180, 'note': '用户 11-17 定：全片约 2 分 40 秒（《方案补充》#36），一镜可以念两三句'},
    'facts': [{'claim': c, 'basis': b, 'status': '待核验'} for c, b in [
        ('研究样本：2 万多名科学家、4 千多位导演、2 千多位画家（20,040 / 4,337 / 2,128）', 'Liu, Dehmamy, Chown, Giles, Wang, Nature Communications 2021'),
        ('研究用 AI（深度学习）分析画作、电影、论文的风格和主题', 'Liu et al. 2021 及西北大学新闻稿'),
        ('大多数人一生至少有一次高光期，平均约四五年，最好的作品集中在里面', 'Liu et al., Nature 2018'),
        ('高光期在职业生涯里出现的时间近似随机', 'Liu et al., Nature 2018'),
        ('高光期之前先探索、之后深挖；只探索或只深挖都和高光期无关', 'Liu et al. 2021'),
        ('试多久才算够，研究者自己说还没有答案', 'Dashun Wang 接受采访（Kellogg Insight 等报道）'),
    ]],
    'shots': [{k: v for k, v in s.items()} for s in SHOTS],
    'version': '1.0.0',
    'audio': {'mode': 'voice', 'voice': voice, 'subtitles': True},
}
(HERE / 'storyboard.json').write_text(json.dumps(sb, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'storyboard.json：{len(voice)} 句配音，最后一句在 {voice[-1]["at"] + voice[-1]["dur"]:.1f} 秒结束')
