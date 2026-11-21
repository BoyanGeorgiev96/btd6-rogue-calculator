import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactConditionHints } from '../src/artifact-summary.js';
import { artifactRules } from '../src/artifact-rules.js';
import { defaults } from '../src/calculator.js';

test('conditional artifact hints identify inactive battle conditions and disappear when active', () => {
  const artifact = id => ({ id });
  assert.deepEqual(artifactConditionHints(artifact('PrimalInstinct'), defaults), [
    { flag: 'close', label: 'Target priority is Close' }
  ]);
  assert.deepEqual(artifactConditionHints(artifact('PrimalInstinct'), { ...defaults, close: true }), []);
  assert.deepEqual(artifactConditionHints(artifact('SlowAndSteady'), defaults), [
    { flag: 'early', label: 'First 20 seconds of round' }
  ]);
});

test('hints cover every supported battle-condition flag used by artifact rules', () => {
  const cases = [
    ['early', 'SlowAndSteady', 'First 20 seconds of round'],
    ['close', 'PrimalInstinct', 'Target priority is Close'],
    ['aura', 'GeneralsDisposition', 'Inside all selected artifact auras'],
    ['glued', 'StickySituation', 'Target is glued'],
    ['frozen', 'CrystalCrash', 'Target is frozen'],
    ['stunned', 'ConfuddlingSpelling', 'Target is stunned or tranced']
  ];
  const ruleFlags = new Set(Object.values(artifactRules).flatMap(rule => rule.effects.map(effect => effect.when?.flag).filter(Boolean)));
  assert.deepEqual(new Set(cases.map(([flag]) => flag)), ruleFlags);
  for (const [flag, id, label] of cases) {
    assert.deepEqual(artifactConditionHints({ id }, defaults), [{ flag, label }]);
  }
});
