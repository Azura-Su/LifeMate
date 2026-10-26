const assert = require('node:assert/strict');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
function fixture(uid='u1',id='pet-a') {
  const seed='1'.repeat(32),part='cat:0';
  const dna={schemaVersion:1,generatorVersion:'hybrid-3d-v1',catalogVersion:'chibi-v1',seed,species:['cat'],parts:{head:part,ears:part,muzzle:part,body:part,feet:part,tail:part},shape:0,material:{paletteSpecies:'cat',code:0},animation:{idle:{clipId:'breathe',variant:0},interaction:{clipId:'happy',variant:0}},skill:{effectId:'fire',variant:0}};
  return {schemaVersion:1,wireVersion:1,ownerId:uid,revision:1,previousRevision:0,lastOperationId:'create-a',updatedAt:100,pet:{petId:id,ownerId:uid,name:'Mây',dna,dnaHash:'a'.repeat(64),appearanceHash:'b'.repeat(64),createdAt:100,updatedAt:100}};
}
module.exports=async function testPets(environment) {
  const owner=environment.authenticatedContext('u1').firestore(),other=environment.authenticatedContext('u2').firestore();
  const path='petAccounts/u1/state/current',ref=owner.doc(path);
  await assertFails(other.doc(path).set(fixture()));
  await assertFails(owner.doc('petAccounts/u1/state/extra').set(fixture()));
  await assertFails(owner.doc('petAccounts/u1/pets/extra').set(fixture()));
  const malformed=fixture();malformed.pet.dna.parts.ears='rabbit:0';
  await assertFails(ref.set(malformed));
  const missing=fixture();delete missing.pet.dna.skill.variant;await assertFails(ref.set(missing));
  const overflow=fixture();overflow.pet.dna.shape=530680951941;await assertFails(ref.set(overflow));
  await assertSucceeds(ref.set(fixture()));
  await assertFails(other.doc(path).get());
  await assertFails(ref.delete());
  const rename={...fixture(),revision:2,previousRevision:1,lastOperationId:'rename-a',updatedAt:200,pet:{...fixture().pet,name:'Nắng',updatedAt:200}};
  await assertSucceeds(ref.set(rename));
  const changedDNA=structuredClone(rename);changedDNA.revision=3;changedDNA.previousRevision=2;changedDNA.lastOperationId='tamper';changedDNA.pet.dna.shape=1;
  await assertFails(ref.set(changedDNA));
  await assertFails(ref.set({...rename,revision:3,previousRevision:2,lastOperationId:'replace',pet:{...rename.pet,petId:'pet-b'}}));
  const deleted={...rename,revision:3,previousRevision:2,lastOperationId:'delete-a',updatedAt:300,pet:null};
  await assertSucceeds(ref.set(deleted));
  assert.equal((await ref.get()).data().pet,null);
  await assertFails(ref.set(fixture())); // delayed offline create cannot revive A
  const next={...fixture('u1','pet-b'),revision:4,previousRevision:3,lastOperationId:'create-b',updatedAt:400};
  await assertSucceeds(ref.set(next));
  await assertFails(ref.set(deleted)); // delayed delete cannot remove B
  await assertFails(ref.set({...next,revision:5,previousRevision:4,lastOperationId:'wrong-owner',ownerId:'u2'}));
  // Two writers based on the same empty revision: only one is admitted.
  await assertSucceeds(ref.set({...deleted,revision:5,previousRevision:4,lastOperationId:'delete-b'}));
  const attempts=await Promise.allSettled(['c','d'].map(id=>ref.set({...fixture('u1',`pet-${id}`),revision:6,previousRevision:5,lastOperationId:`create-${id}`})));
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  await environment.withSecurityRulesDisabled(async context=>{await context.firestore().doc('accountAccess/pet-revoked').set({status:'disabled',validSince:0});});
  await assertFails(environment.authenticatedContext('pet-revoked').firestore().doc('petAccounts/pet-revoked/state/current').set(fixture('pet-revoked')));
  const hybrid=fixture('pet-hybrid');hybrid.pet.dna.species=['cat','owl','rabbit'];hybrid.pet.dna.parts.ears='rabbit:1';hybrid.pet.dna.parts.wings='owl:2';
  await assertSucceeds(environment.authenticatedContext('pet-hybrid').firestore().doc('petAccounts/pet-hybrid/state/current').set(hybrid));

  // Additive V2 species support must retain the frozen V1 contract.
  const newSpecies=['panda','hamster','penguin','deer','tiger','pig'];
  function v2(uid, selected) {
    const value=fixture(uid); const dna=value.pet.dna;
    dna.generatorVersion='hybrid-3d-v2'; dna.catalogVersion='chibi-v2';dna.species=selected;
    Object.keys(dna.parts).forEach((key,i)=>{dna.parts[key]=`${selected[i%selected.length]}:0`;});
    const bird=selected.find(s=>s==='owl'||s==='penguin');if(bird)dna.parts.wings=`${bird}:1`;
    dna.material.paletteSpecies=selected[0];return value;
  }
  for(const animal of newSpecies) {
    const uid=`pet-v2-${animal}`;
    await assertSucceeds(environment.authenticatedContext(uid).firestore().doc(`petAccounts/${uid}/state/current`).set(v2(uid,[animal])));
  }
  for(const selected of [['panda','penguin','fox'],['owl','penguin','rabbit']]) {
    const uid=`pet-mix-${selected[0]}`;
    await assertSucceeds(environment.authenticatedContext(uid).firestore().doc(`petAccounts/${uid}/state/current`).set(v2(uid,selected)));
  }
  const malformedV2 = [
    d=>{d.generatorVersion='hybrid-3d-v1';d.catalogVersion='chibi-v1';},
    d=>{d.catalogVersion='chibi-v1';},
    d=>{d.generatorVersion='hybrid-3d-v3';},
    d=>{d.parts.wings='owl:0';},
    d=>{delete d.parts.wings;},
    d=>{d.parts.head='tiger:0';},
    d=>{d.parts.head='panda:3';},
    d=>{d.parts.head='penguin:0';d.parts.muzzle='penguin:0';d.parts.feet='penguin:0';},
  ];
  for(let i=0;i<malformedV2.length;i++) {
    const uid=`pet-invalid-v2-${i}`,value=v2(uid,['panda','penguin']);malformedV2[i](value.pet.dna);
    await assertFails(environment.authenticatedContext(uid).firestore().doc(`petAccounts/${uid}/state/current`).set(value));
  }
  console.log('Pet rules: singleton, owner, genome, revision, delete/recreate and concurrent create passed');
};
