<script setup>
import { computed } from 'vue';
import { character, saveCharacter, currentPackage, eraInfo } from '../../store.js';
import { t, dataName, flavorText, storyText } from '../../i18n.js';
import { eraDiceTables } from '../../data/eras.js';
import {
  APPEARANCE_DESCRIPTIONS,
  PERSONALITY_TRAITS,
  PERSONALITY_FLAWS,
  IMPORTANT_PERSON_TYPES,
  MEANINGFUL_PLACES,
  PRECIOUS_ITEMS,
  ERA_BACKGROUNDS,
} from '../../data/story.js';

// 修订版八项背景要素：前四项车卡时至少各写一条；伤势与疤痕、恐惧为游戏中记录项
// 法术典籍与遭遇奇异实体由「克苏鲁神话」步骤（mythosItems/spells/contacts）承载
const fields = [
  { key: 'app', label: () => t('bg.fields.app'), ph: () => t('bg.phs.app'), random: true },
  { key: 'personality', label: () => t('bg.fields.personality'), ph: () => t('bg.phs.personality'), random: true },
  { key: 'personPlace', label: () => t('bg.fields.personPlace'), ph: () => t('bg.phs.personPlace'), random: true },
  { key: 'item', label: () => t('bg.fields.item'), ph: () => t('bg.phs.item'), random: true },
  { key: 'scar', label: () => t('bg.fields.scar'), ph: () => t('bg.phs.scar') },
  { key: 'fear', label: () => t('bg.fields.fear'), ph: () => t('bg.phs.fear') },
  { key: 'desc', label: () => t('bg.fields.desc'), ph: () => t('bg.phs.desc') },
];

const required = computed(() => currentPackage.value?.requiredBackgrounds || []);

// 时代信息（派系 / 掷骰表结果）：本地化重建（store 的 eraInfo 为中文摘要）
const eraInfoLocal = computed(() => {
  const parts = [];
  const table = eraDiceTables[character.era];
  const roll = character.eraEffects?.[character.era];
  if (table && roll && roll.dice) {
    const entry = table.entries[roll.dice - 1];
    if (entry) parts.push(`${dataName(table.title)}（1D10=${roll.dice}）：${dataName(entry.text)}（${flavorText(entry.note)}）`);
  }
  if (character.eraFaction) parts.push(`${t('bg.eraInfo')}：${dataName(character.eraFaction)}`);
  return parts;
});

// 当前时代专属背景表（仅 不败/黑暗/冰岛 在书中有专属表，其余沿用标准表）
// 点击字段旁的骰子按钮时，从当前时代对应的随机表中抽取
const eraBg = computed(() => ERA_BACKGROUNDS[character.era] || {});

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 根据字段返回随机抽取的文本；个性需特质＋缺点各掷一次组合，重要之人与地点需人物／地点各取一项
function randomText(key) {
  const bg = eraBg.value;
  switch (key) {
    case 'app': return storyText(pick(APPEARANCE_DESCRIPTIONS));
    case 'personality': return `${storyText(pick(PERSONALITY_TRAITS))}\n${storyText(pick(PERSONALITY_FLAWS))}`;
    case 'personPlace':
      return `${storyText(pick(bg.importantPerson || IMPORTANT_PERSON_TYPES))}\n${storyText(pick(bg.place || MEANINGFUL_PLACES))}`;
    case 'item': return storyText(pick(bg.item || PRECIOUS_ITEMS));
    default: return '';
  }
}

function fillRandom(f) {
  if (!f.random) return;
  character.background[f.key] = randomText(f.key);
  saveCharacter();
}
</script>

<template>
  <div class="step fade-in">
    <div class="card">
      <div class="card-title"><h2>{{ $t('bg.title') }}</h2><span class="sub">{{ $t('bg.sub') }}</span></div>
      <div class="card-body">
        <!-- 时代信息（派系 / 随机表结果）：只读展示，不可在此修改 -->
        <div v-if="eraInfoLocal.length" class="era-info-box">
          <span class="era-info-label">{{ $t('bg.eraInfo') }}</span>
          <p v-for="(t, i) in eraInfoLocal" :key="i">{{ t }}</p>
        </div>

        <div class="grid-2">
          <div v-for="f in fields" :key="f.key" :class="{ 'span-2': f.key === 'desc' }">
            <div class="lbl">
              <b>{{ f.label() }}</b>
              <button v-if="f.random" class="rand-btn" type="button" :title="t('bg.randomTitle', { label: f.label() })" @click.stop="fillRandom(f)">
                <font-awesome-icon icon="fa-solid fa-dice" />
              </button>
            </div>
            <textarea class="inp" v-model="character.background[f.key]" @input="saveCharacter" :placeholder="f.ph()" :style="f.key === 'desc' ? 'min-height:120px' : ''"></textarea>
          </div>
        </div>

        <div v-if="required.length" class="req-box mt-16">
          <p class="warn-text">{{ $t('bg.requiredTitle') }}</p>
          <ul class="req-list">
            <li v-for="(r, i) in required" :key="i" class="warn-text">{{ r }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.span-2 { grid-column: span 2; }
.lbl { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rand-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border, #3a3f4b);
  border-radius: var(--radius, 8px);
  background: var(--surface-2, #2a2f3a);
  color: var(--accent, #6aa3ff);
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
}
.rand-btn:hover { background: var(--accent, #6aa3ff); color: #fff; border-color: var(--accent, #6aa3ff); }
.rand-btn:active { transform: translateY(1px); }
.era-info-box {
  background: var(--surface-2); border: 1px solid var(--accent); border-radius: var(--radius);
  padding: 10px 14px; margin-bottom: 14px; line-height: 1.6;
}
.era-info-box p { margin: 3px 0; color: var(--text); }
.era-info-label { display: block; font-size: 0.78rem; color: var(--accent-strong); margin-bottom: 2px; letter-spacing: 0.02em; }
.req-box { background: var(--danger-bg); border: 1px solid var(--danger); border-radius: var(--radius); padding: 12px 16px; }
.req-list { margin: 6px 0 0; padding-left: 20px; }
@media (max-width: 640px) { .span-2 { grid-column: span 1; } }
</style>
