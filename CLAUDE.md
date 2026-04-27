# Paper RPG — Project Specification

## 项目概述

将科研论文自动转化为开放世界 RPG 游戏的 Web 应用。用户上传一篇论文 PDF，系统通过多个 AI Agent 协作，自动生成游戏世界观、剧情、地图、NPC 和任务，用户可以在游戏中探索论文内容、与 NPC 对话、完成任务，最终在与作者 NPC 的对话中验证对论文的理解。

Demo 论文：Vaswani et al., "Attention Is All You Need" (2017)

---

## 技术栈

- **后端**：Python + FastAPI
- **前端**：React + Vite（暂不实现，先专注后端）
- **模型调用**：统一封装，支持 OpenAI / Claude / DeepSeek 等任意模型，可按 Agent 分配不同模型
- **PDF 解析**：pdfplumber
- **流式返回**：SSE（Server-Sent Events）

---

## 项目结构

```
paper-rpg/
├── backend/
│   ├── main.py                  # FastAPI 入口，路由定义
│   ├── agents/
│   │   ├── director.py          # Director Agent（核心，生成世界圣经）
│   │   ├── story.py             # Story Agent（生成叙事文本）
│   │   ├── map_agent.py         # Map Agent（生成地图数据）
│   │   ├── npc_spawner.py       # NPC Spawner（并行生成所有NPC）
│   │   ├── npc.py               # NPC Agent（运行时对话）
│   │   ├── assembly.py          # Assembly Agent（整合+一致性检查）
│   │   └── runtime.py           # Runtime Agent（游戏运行时主持人）
│   ├── models/
│   │   └── llm_client.py        # 统一模型调用封装
│   ├── prompts/
│   │   ├── director.txt
│   │   ├── story.txt
│   │   ├── map.txt
│   │   ├── npc_template.txt
│   │   ├── assembly.txt
│   │   └── runtime.txt
│   ├── schemas.py               # Pydantic 数据结构
│   ├── utils.py                 # PDF解析、SSE辅助函数
│   └── requirements.txt
└── frontend/                    # 暂不实现
```

---

## Agent 架构

### 生成阶段（用户上传论文后触发，一次性运行）

```
用户上传 PDF + 问卷答案
         ↓
   [Director Agent]       ← 读全文，产出"世界圣经"JSON
         ↓
    ┌────┼──────────────┐
    ↓    ↓              ↓
[Story] [Map]     [NPC Spawner]
Agent   Agent     并行生成 N 个 NPC
                  （N 由世界圣经决定）
    ↓    ↓              ↓
         └──────┬────────┘
          [Assembly Agent]
          整合 + 一致性检查
          输出最终游戏数据 JSON
```

- Story Agent 和 Map Agent **并行**运行（`asyncio.gather`）
- NPC Spawner 内部也**并行**生成所有 NPC
- Assembly Agent 最后做整合和一致性检查

### 运行阶段（游戏进行中，实时响应）

```
玩家输入
   ↓
[Runtime Agent]   ← 路由中心，维护 game_state
   ↓
对应的 [NPC Agent]  ← 无状态，每次调用传入完整上下文
   ↓
返回回复
```

---

## 核心数据结构：世界圣经（World Bible）

Director Agent 的输出，是所有其他 Agent 的输入依据。

```json
{
  "world": {
    "world_name": "世界名称",
    "fundamental_conflict": "世界根本矛盾（一句戏剧性的话）",
    "historical_timeline": [
      {
        "era": "时代名称",
        "reference_paper": "对应的引用文献",
        "description": "这个时代发生了什么（游戏化语言）"
      }
    ],
    "current_crisis": "当前危机描述（论文发表前的黑暗时刻）",
    "victory_condition": "胜利条件（评估指标的具象化描述）",
    "tone": "epic | mystery | adventure | philosophical"
  },
  "narrative_type": "method | theory | system | survey",
  "acts": [
    {
      "act_id": 1,
      "name": "幕名称",
      "paper_section": "对应论文章节",
      "game_role": "世界观建立·危机爆发",
      "area_name": "区域名称",
      "area_type": "town | ruins | temple | arena | forge | library | abyss",
      "main_quest": "主线任务描述",
      "side_quests": ["支线任务1", "支线任务2"],
      "unlock_condition": "previous_act_complete"
    }
  ],
  "npcs": [
    {
      "npc_id": "npc_001",
      "type": "A | B | C",
      "name": "NPC名称",
      "real_reference": "对应的论文/概念/人物",
      "location_act": 1,
      "role_in_story": "在故事中的角色",
      "personality": "性格描述",
      "knowledge_domain": "负责解释的知识领域",
      "quest_given": "给玩家的任务",
      "unlock_condition": "解锁条件"
    }
  ],
  "boss": {
    "name": "Boss名称",
    "represents": "代表哪个baseline/旧方法",
    "battle_mechanic": "combat | debate | puzzle | construction",
    "weakness": "对应论文的核心创新点"
  },
  "author_npc": {
    "name": "作者名称",
    "personality": "性格描述",
    "exam_questions": [
      {
        "question": "考察问题",
        "difficulty": "beginner | intermediate | expert",
        "key_concepts": ["关键概念1", "关键概念2"]
      }
    ]
  },
  "map_hints": {
    "geography_type": "two_continents | archipelago | vertical_layers | labyrinth",
    "special_landmark": "标志性地点描述"
  },
  "freedom_notes": "本次设计的非标准处理说明"
}
```

---

## NPC 类型说明

| 类型 | 来源 | 数量 | 说明 |
|------|------|------|------|
| A 类 | 引用文献 | 3–8 个 | 代表历史上的重要工作，住在 Background 区域，知识仅限于其时代 |
| B 类 | 论文核心概念/组件 | 3–6 个 | 代表论文提出的核心概念，玩家理解该概念后才算"招募"成功 |
| C 类 | 论文作者 | 1 个 | 隐藏在游戏深处，了解论文一切，游戏最后阶段出现，考察玩家理解 |

---

## 剧情结构（通用模板，对应任意论文）

| 论文章节 | 剧情角色 | 游戏机制 | 区域类型 |
|----------|----------|----------|----------|
| Abstract | 开场预言 | 30秒CG动画，埋下悬念 | — |
| Introduction | 世界观建立·危机爆发 | 新手村，NPC讲述世界现状 | town |
| Related Work / Background | 长老村·前人遗产 | 解锁A类文献NPC，收集古代知识碎片 | ruins / library |
| Method / Architecture | 锻造神器·习得技能 | 最大探索区域，任务密度最高 | temple / forge |
| Experiments / Setup | 试炼场·准备出发 | 副本，理解评估指标 | arena |
| Results | Boss 战 | 用收集到的武器（方法理解）击败 Baseline | abyss |
| Ablation / Analysis | 隐藏副本·彩蛋 | 可选支线，深度玩家探索 | ruins |
| Conclusion | 尾声·新的旅程 | 世界改变，作者NPC现身，考察玩家 | — |

**重要**：Director Agent 不必完全按照此模板，可根据论文类型调整 act 数量（4–8个均可）和 Boss 战形式。

---

## 论文类型与叙事风格对应

| 论文类型 | 叙事模板 | 典型 Boss 战形式 |
|----------|----------|-----------------|
| method | 英雄铸造神器击败旧方法 | combat（新方法 vs baseline）|
| theory | 揭开宇宙法则，破除错误认知 | debate（理论推导对决）|
| system | 建造能解决危机的伟大工程 | construction（系统搭建挑战）|
| survey | 整合碎片历史，寻找新方向 | puzzle（拼图式理解验证）|

---

## 世界观构建逻辑（Director Agent 执行）

1. **确定世界根本矛盾**：把论文要解决的问题升华为世界层面的存在危机
   - 示例：机器翻译不够好 → "巴别诅咒让各族语言永远隔离"
   - 示例：RNN 无法并行 → "遗忘诅咒让信息在长距离传递中不断衰减"

2. **研究历史线 → 世代叙事**：每篇关键引用文献 = 历史上的英雄时代

3. **评估指标具象化**：
   - BLEU score 涨了 = 巴别诅咒减弱，可以观测
   - Accuracy 涨了 = 黑雾消退了多少

---

## 玩家问卷（上传论文后询问）

```json
{
  "background": "novice | intermediate | expert",
  "preference": "guided | self-directed",
  "time": "quick(30min) | normal(1-2h) | deep(3h+)",
  "goal": "overview | deep-understanding | paper-replication"
}
```

问卷答案传给 Director Agent，影响：
- 任务密度和解释深度
- NPC 对话的技术程度
- 作者 NPC 考察题的难度

---

## API 接口定义

### POST `/api/generate-world`

**输入**：
- `pdf_file`：论文 PDF 文件
- `questionnaire`：问卷答案 JSON 字符串

**输出**：SSE 流式返回，事件类型如下：

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `progress` | 每个 Agent 开始/结束 | `{"step": "director", "status": "running"}` |
| `world_bible` | Director Agent 完成 | 世界圣经 JSON |
| `complete` | Assembly Agent 完成 | 最终游戏数据 JSON |
| `error` | 任意步骤出错 | `{"step": "...", "message": "..."}` |

### POST `/api/npc-chat`

**输入**：
```json
{
  "npc_data": {},        // 该NPC的完整设定（从游戏数据中取）
  "message": "玩家消息",
  "history": [],         // 与该NPC的历史对话
  "player_profile": {},  // 问卷答案
  "world_bible": {}      // 世界圣经摘要
}
```

**输出**：`{"reply": "NPC回复"}`

### GET `/api/health`

健康检查接口，返回 `{"status": "ok"}`

---

## 模型调用封装（llm_client.py）

支持多 provider，各 Agent 可以独立配置使用不同模型：

```python
class LLMClient:
    def __init__(self, provider="openai", model="gpt-4o"):
        # provider: "openai" | "claude" | "deepseek" | "gemini"
        # deepseek 兼容 OpenAI 接口，base_url 设为 https://api.deepseek.com

    def chat(self, system: str, user: str, json_mode=False) -> str:
        # 统一调用，返回字符串

    def chat_json(self, system: str, user: str) -> dict:
        # 调用并解析 JSON，自动清理 ```json 包裹
```

**推荐配置**：
- Director Agent：能力最强的模型（输出质量最关键）
- Story / Map Agent：能力较强的模型
- NPC Spawner（批量生成）：便宜的模型（如 deepseek-chat / gpt-4o-mini）
- NPC 运行时对话：便宜的模型（调用频繁）

---

## 关键实现细节

### PDF 解析
使用 `pdfplumber` 提取正文，注意 token 限制，超长论文截取前 60000 字符（约 15000 tokens）。

### 并行执行
Story Agent 和 Map Agent 用 `asyncio.gather` 并行运行。
NPC Spawner 内部也用 `asyncio.gather` 并行生成所有 NPC。

### NPC 运行时状态管理
- NPC Agent 本身无状态（每次调用传入完整上下文）
- `game_state` 由 Runtime Agent 维护，记录玩家位置、已完成任务、与各 NPC 的对话历史
- 对话历史按 `npc_id` 分组存储，避免 token 无限增长

### JSON 输出清理
部分模型在 JSON mode 下仍会输出 ` ```json ` 包裹，需要在 `chat_json` 方法里统一清理：
```python
raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
```

### 错误处理
每个 Agent 函数需要 try/except，出错时通过 SSE 的 `error` 事件通知前端，并提供降级处理（如 Director 失败则整个流程终止，NPC 单个失败则跳过该 NPC）。

---

## Prompt 文件说明

所有 prompt 存在 `prompts/` 目录下的 `.txt` 文件中，通过 `load_prompt(filename)` 读取。

### director.txt 的核心指令结构

Director Agent 分三步输出：
1. **Step 1 论文解析**：论文类型、核心贡献、关键前驱工作、核心概念、评估指标
2. **Step 2 世界观构建**：world_name、fundamental_conflict、historical_timeline、current_crisis、victory_condition、tone
3. **Step 3 游戏结构设计**：输出完整世界圣经 JSON

重要指令：告知 Director Agent 它有一定自主权，不必完全按照模板，可以根据论文特点调整 act 数量和 Boss 战形式，在 `freedom_notes` 字段说明非标准设计。

### npc_template.txt 的核心指令结构

- 根据 NPC 类型（A/B/C）给出不同的角色定位说明
- A 类：知识仅限于其时代，对后来发展半知半解
- B 类：对自身机制非常了解，需要玩家"激活"才能完全发挥
- C 类：了解论文一切，游戏最后阶段考察玩家，根据回答质量给出不同层次反馈，永远不说"你答错了"
- 根据玩家背景（novice/intermediate/expert）调整解释深度

---

## AIAYN 举例（用于测试和开发验证）

**世界名**：Linguamundi

**根本矛盾**：遗忘诅咒——所有信息只能沿序列线性传递，长距离传递中不断衰减，各族无法真正理解彼此。

**历史时间线**：
- Sequential Age（RNN时代）：Hochreiter 英雄用记忆门减缓了遗忘，但诅咒未除
- Attention Dawn（Bahdanau 2015）：第一次引入局部注意力，打破诅咒一角，仍依赖 RNN 骨架
- Transformer Era（本论文）：玩家所处时代，需彻底废除 RNN，实现纯注意力

**NPC 设计示例**：
- Bahdanau（A类）：图书馆老学者，教早期 attention 机制，对 Transformer 的细节半知半解
- Hochreiter（A类）：坚守 LSTM 要塞的老将军，认为记忆门才是正道，可以作为 Boss 前的对话 NPC
- Multi-Head Attention（B类）：能同时从 8 个角度思考的神秘法师，玩家理解 attention 机制后招募
- Positional Encoding（B类）：为每个位置刺青标记的符文师，玩家理解位置编码后招募
- Feed-Forward Network（B类）：铸造武器的锻造师，玩家理解 FFN 后招募
- Vaswani et al.（C类）：七贤者之首，隐藏在游戏最深处，最后考察玩家

**地图结构**：
- 左大陆：Encoder Realm（理解之地）
- 右大陆：Decoder Realm（生成之地）
- 中间海域：Cross-Attention Sea（Keys 和 Values 在此传递）
- 南方深渊：LSTM Fortress（Boss 所在地）
- 六座山峰（每块大陆各六座）：对应 N=6 的 Encoder/Decoder 层

**Boss 战**：Sequential Dragon（LSTM），弱点是"并行注意力"，用序列递推攻击伤害低且会被反击。

---

## 开发优先级

1. **第一步**：`llm_client.py` + `utils.py`（PDF 解析 + SSE 工具函数）
2. **第二步**：`director.py` + `director.txt` prompt，跑通世界圣经生成
3. **第三步**：`story.py` + `map_agent.py` + `npc_spawner.py`（并行生成）
4. **第四步**：`assembly.py`（整合检查）
5. **第五步**：`npc.py` + `runtime.py`（运行时对话）
6. **第六步**：`main.py` 整合所有路由，加错误处理

先用 AIAYN 这篇论文做端到端测试，验证每一步的输出质量再继续。

---

## 当前实现状态（截至 2026-04-27）

### 已完成

**后端（全部跑通）**
- `llm_client.py`：支持 deepseek / openai / claude(poe) / gemini，含 `_extract_json()` 鲁棒解析
- `director.py`：两步法（step1 自由分析 + step2 JSON提取），用 `asyncio.to_thread` 避免阻塞
- `story.py` + `map_agent.py`：并行生成，map_agent 传结构化摘要（不传"世界圣经"原文避免模型误解）
- `npc_spawner.py`：并行生成所有 NPC，`_get_npcs()` 多 key 容错
- `assembly.py`：仅传摘要给 LLM 做一致性检查，数据直接合并（避免大 JSON 截断）
- `npc.py` + `runtime.py`：NPC 无状态对话，`_initial_state` 初始化游戏状态
- `main.py`：所有路由，含 `/api/generate-quiz`（按 act 生成4选1测验题）
- `prompts/__init__.py`：`_PromptTemplate` 自定义 `.format()`，避免 prompt 中 `{}` 被 Python 误解析

**前端**
- `LoadingScreen.jsx`：SSE 流式展示生成进度（Director → Story/Map → NPC → Assembly）
- `GameScreen.jsx`：左图右面板布局，维护 `chatHistories`（按 npc_id 键控）、quiz 状态、区域解锁逻辑
- `MapPanel.jsx`：Canvas 像素风地图，区域锁定/解锁视觉，NPC 点状指示器
- `RegionInfo.jsx`：区域信息 + 主线/支线任务 + NPC 列表 + "前往下一区域"按钮（需先与所有 NPC 对话）
- `ChatPanel.jsx`：NPC 对话，历史持久化，知识点快捷按钮
- `QuizModal.jsx`：区域过关测验，选择题 + 正误反馈 + 解释 + 进入下一区域

### 关键技术决策

| 问题 | 解决方案 |
|------|---------|
| gpt-5.2 无视指令只输出 `{"choice":"A"}` | 全部切换为 `deepseek-chat` |
| map_agent 拒绝执行（说"世界圣经内容不足"） | 不传"世界圣经"字眼，改传结构化摘要 |
| poe/claude 不支持 `text={"format":{"type":"json_object"}}` | 移除该参数，改用 prompt 指令 |
| prompt 中 JSON 示例 `{}` 触发 Python KeyError | `_PromptTemplate` 只替换显式传入的 key |
| Assembly 输入过大导致截断 | 只传紧凑摘要，数据直接程序合并 |
| NPC 解锁状态：新区域 NPC 无法交互 | `doUnlock()` 同时把 `npcs_here` 加入 `unlocked_npcs` |

### 当前模型配置

所有 agent 均使用 `deepseek-chat`（provider="deepseek"）。API key 在 `backend/.env` 中：
```
DEEPSEEK_API_KEY=...
POE_API_KEY=...   # 备用，目前未用
```

### 游戏流程（已可玩）

1. 上传 PDF + 填写问卷 → SSE 流式生成（约 2-3 分钟）
2. 进入游戏：像素风地图 + 右侧区域信息面板
3. 点击 NPC 对话（历史跨关闭保持）
4. 与当前区域所有 NPC 各对话至少一次后，"前往下一区域"按钮激活
5. 点击按钮 → 生成测验题 → 答题（对错均可继续）→ 解锁下一区域并自动跳转

### 未实现（可探索方向）

- **可探索元素交互**：目前只展示静态文本，无点击行为。可做：点击展开详情（方案A）/ 触发旁白生成（方案B）
- **Boss 战**：world_bible 有 boss 字段但前端没有对应界面
- **作者 NPC 考核流程**：C 类 NPC 有 exam_questions，但没有特殊 UI 区分
- **游戏进度持久化**：刷新页面进度丢失（game_state 只在内存中）
- **区域完成追踪**：目前任务只展示文本，没有勾选/完成状态

### 本地启动

```bash
cd /Users/njrt/Desktop/paper_rpg
./start.sh
# 前端：http://localhost:5173
# 后端：http://localhost:8000
```

公网测试用 ngrok：
```bash
brew install ngrok
ngrok http 5173
```