'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const fixture = `
uistub.install(); stub.login()
local L = Polestar.LiveQuestie
local calls = { world = 0, tooltip = 0 }
Polestar.Compat.MapToWorld = function(map, x, y)
  calls.world = calls.world + 1
  return map == 1438 and 1 or 0, 1000-y*10, 1000-x*10
end
local tip
Polestar.Widgets = {
  Tooltip = function(_, _, title, lines) calls.tooltip=calls.tooltip+1; tip={title=title,lines=lines} end,
  HideTip = function() end,
}
local parent=CreateFrame('Frame'); parent:SetSize(1000,1000); parent:Show()
local layer=L.Create(parent)
local map={art=true,bounds={c=1,left=1000,top=1000,kx=-.001,ky=-.001},
  View={width=1000,height=1000,offsetX=0,offsetY=0,drawWidth=1000,drawHeight=1000,scale=1}}
local frames={}
local quest={name="Zenn's Bidding"}
local objective={Description='Nightsaber Fang',Collected=1,Needed=3,Completed=false}
QuestieLoader={_modules={QuestieMap={questIdFrames={}}, QuestLogCache={TryGetQuest=function(id)
  return {title="Zenn's Bidding",objectives={{text='1/3 Nightsaber Fang'}}}
end}}}
local registry=QuestieLoader._modules.QuestieMap.questIdFrames
local function pin(name, x, y, mini, obj, id)
  local frame=CreateFrame('Button',name)
  frame.data={Id=id or 488,Type='item',Icon=7,Name='Nightsaber',ObjectiveIndex=1,
    QuestData=quest,ObjectiveData=obj or objective}
  frame.UiMapID,frame.x,frame.y,frame.miniMapIcon=1438,x,y,mini
  frame.texture=frame:CreateTexture(); frame.texture:SetTexture('Interface/Questie/loot.blp')
  frame.texture:SetVertexColor(mini and .2 or .7,.8,.3,mini and .2 or 1)
  frame.texture.GetTexCoord=function() return 0,0,0,1,1,0,1,1 end
  frame:Hide() -- world-map visibility must not decide whether our copy appears
  frame.ShouldBeHidden=function() error('adapter must not invoke Questie behaviour') end
  frame.SetPoint=function() error('adapter must not move Questie frames') end
  frame.Show=function() error('adapter must not show Questie frames') end
  local qid=frame.data.Id
  registry[qid]=registry[qid] or {}; registry[qid][name]=name
  frames[#frames+1]=frame
  return frame
end
`;
function run(script) {
  return runAddon({ stubs: ['stub_ui.lua'], addons: [{ name: 'Polestar', files: ['Core/Core.xml', 'UI/LiveQuestie.lua'] }], script: fixture + script }).emitted;
}

test('Questie world and minimap copies become one correctly projected spawn with original icon and hover details', () => {
  const [s] = run(`
    local a=pin('QuestieTest1',60,40,false)
    local b=pin('QuestieTest2',60,40,true)
    layer:Refresh(map)
    local m=layer.Markers[1]; m:GetScript('OnEnter')(m)
    emit({count=layer.markerCount,scene=#layer.scene,position={point=m.points[1].relPoint,x=m.points[1].x,y=m.points[1].y},icon=m.Icon:GetTexture(),
      color=m.Icon.vertexColor,uv=m.Icon.texCoord,tip=tip,sourceShown=a:IsShown(),sourceHidden=b:IsShown()})
  `);
  assert.equal(s.count, 1);
  assert.equal(s.scene, 1);
  assert.equal(s.position.point, 'TOPLEFT');
  assert.equal(s.position.x, 600);
  assert.equal(s.position.y, -400);
  assert.equal(s.icon, 'Interface/Questie/loot.blp');
  assert.deepEqual(s.color, [.2, .8, .3, 1]);
  assert.deepEqual(s.uv, [0, 0, 0, 1, 1, 0, 1, 1]);
  assert.equal(s.tip.title, 'Nightsaber');
  assert.ok(s.tip.lines.includes("Zenn's Bidding"));
  assert.ok(s.tip.lines.includes('1/3 Nightsaber Fang'));
  assert.equal(s.sourceShown, false);
  assert.equal(s.sourceHidden, false);
});

test('minimap objective halo survives a closed world map and uses live objective color independently of icon tint', () => {
  const [a, b, c, d] = run(`
    Questie={db={profile={alwaysGlowMinimap=true,alwaysGlowMap=false,questMinimapObjectiveColors=false}},
      icons={glow='Interface/AddOns/Questie/Icons/glow.blp'}}
    local source=pin('coloredWorldOnly',60,40,false)
    source.data.IconColor={.1,.2,.3}; objective.Color={.8,.3,.1}
    source.glowTexture=source:CreateTexture(); source.glowTexture:SetTexture(Questie.icons.glow)
    source.glowTexture:SetVertexColor(.9,.9,.9,0); source.glowTexture:Hide()
    layer:Refresh(map)
    local m=layer.Markers[1]
    emit({glow=m.Glow:IsShown(),color=m.Glow.vertexColor,icon=m.Icon.vertexColor,
      texture=m.Glow:GetTexture(),width=m.Glow:GetWidth(),sourceGlow=source.glowTexture:IsShown(),sourceColor=source.glowTexture.vertexColor})
    objective.Color={.2,.7,.4}; Questie.db.profile.questMinimapObjectiveColors=true
    stub.advance(.51); layer:Refresh(map)
    emit({glow=m.Glow:IsShown(),color=m.Glow.vertexColor,icon=m.Icon.vertexColor})
    Questie.db.profile.alwaysGlowMinimap=false
    stub.advance(.51); layer:Refresh(map)
    emit({glow=m.Glow:IsShown(),icon=m.Icon.vertexColor})
    Questie.db.profile.alwaysGlowMinimap=true; objective.Color=nil
    stub.advance(.51); layer:Refresh(map)
    emit({glow=m.Glow:IsShown(),count=layer.markerCount})
  `);
  assert.equal(a.glow, true);
  assert.deepEqual(a.color, [.8, .3, .1, 1]);
  assert.deepEqual(a.icon, [1, 1, 1, 1]);
  assert.equal(a.texture, 'Interface/AddOns/Questie/Icons/glow.blp');
  assert.ok(Math.abs(a.width - 18 * 1.13) < 1e-9);
  assert.equal(a.sourceGlow, false);
  assert.deepEqual(a.sourceColor, [.9, .9, .9, 0]);
  assert.deepEqual(b, { glow: true, color: [.2, .7, .4, 1], icon: [.1, .2, .3, 1] });
  assert.deepEqual(c, { glow: false, icon: [.1, .2, .3, 1] });
  assert.deepEqual(d, { glow: false, count: 1 });
});

test('coincident objective colors have a stable source and prefer the minimap style without distance fading', () => {
  const [s] = run(`
    Questie={db={profile={alwaysGlowMinimap=true}},icons={glow='Interface/AddOns/Questie/Icons/glow.blp'}}
    objective.Color={.2,.8,.4}
    local first=pin('firstColor',60,40,false)
    pin('firstMiniColor',60,40,true)
    local second=pin('secondColor',60,40,true,{Description='Feather',Color={.9,.1,.4}})
    second.data.ObjectiveIndex=2
    layer:Refresh(map)
    local m=layer.Markers[1]
    emit({count=layer.markerCount,color=m.Glow.vertexColor,icon=m.Icon.vertexColor,entries=#m.spawn.entries})
  `);
  assert.deepEqual(s, {count: 1, color: [.2, .8, .4, 1], icon: [.2, .8, .3, 1], entries: 2});
});

test('logical Questie hiding, completed objectives, removed pins and unrelated quest giver pins are excluded', () => {
  const [a, b] = run(`
    pin('active',60,40,false)
    local hidden=pin('hidden',61,40,false); hidden.hidden=true
    local done=pin('done',62,40,false,{Description='Owl Feather',Collected=3,Needed=3,Completed=true})
    local hiddenObjective=pin('hiddenObjective',63,40,false,{HideIcons=true})
    local available=pin('available',64,40,false); available.data.Type='available'
    local recycled=pin('recycled',65,40,false); recycled.data=nil
    layer:Refresh(map); emit({count=layer.markerCount,scene=#layer.scene})
    objective.Completed=true; stub.advance(.51); layer:Refresh(map)
    emit({count=layer.markerCount,shown=layer.Markers[1]:IsShown(),status=layer:GetStatus()})
  `);
  assert.deepEqual(a, { count: 1, scene: 1 });
  assert.equal(b.count, 0);
  assert.equal(b.shown, false);
  assert.equal(b.status, 'No active Questie spawn pins');
});

test('refresh is throttled, coordinate cache follows recycled frames, and disabled or hidden layer does no scanning', () => {
  const [a, b, c, d] = run(`
    local pin=pin('active',60,40,false)
    layer:Refresh(map); layer:Refresh(map)
    emit({scans=layer.scanCount,world=calls.world})
    stub.advance(.51); layer:Refresh(map)
    emit({scans=layer.scanCount,world=calls.world})
    pin.x=70; stub.advance(.51); layer:Refresh(map)
    emit({scans=layer.scanCount,world=calls.world,x=layer.Markers[1].points[1].x})
    layer:SetEnabled(false); stub.advance(2); layer:Refresh(map)
    layer:SetEnabled(true); parent:Hide(); layer:Refresh(map)
    emit({scans=layer.scanCount,world=calls.world,shown=layer.Markers[1]:IsShown()})
  `);
  assert.deepEqual(a, { scans: 1, world: 1 });
  assert.deepEqual(b, { scans: 2, world: 1 });
  assert.deepEqual(c, { scans: 3, world: 2, x: 700 });
  assert.deepEqual(d, { scans: 3, world: 2, shown: false });
});

test('coincident spawns merge distinct mobs and objective tooltips without duplicate world/minimap entries', () => {
  const [s] = run(`
    pin('first',60,40,false)
    pin('firstMini',60,40,true)
    local second=pin('second',60,40,false,{Description='Strigid Owl Feather',Collected=2,Needed=3})
    second.data.Name='Strigid Owl'; second.data.ObjectiveIndex=2
    layer:Refresh(map)
    local m=layer.Markers[1]; m:GetScript('OnEnter')(m)
    emit({count=layer.markerCount,entries=#layer.scene[1].entries,tip=tip})
  `);
  assert.equal(s.count, 1);
  assert.equal(s.entries, 2);
  assert.equal(s.tip.title, 'Questie spawns');
  assert.ok(s.tip.lines.includes('Nightsaber'));
  assert.ok(s.tip.lines.includes('Strigid Owl'));
  assert.ok(s.tip.lines.includes('Strigid Owl Feather  2/3'));
});

test('absent or not-yet-ready Questie remains optional and recovers once its pins appear', () => {
  const [a, b, c] = run(`
    local original=QuestieLoader; QuestieLoader=nil
    layer:Refresh(map); emit({status=layer:GetStatus(),count=layer.markerCount})
    QuestieLoader={_modules={}}; stub.advance(.51); layer:Refresh(map)
    emit({status=layer:GetStatus(),count=layer.markerCount})
    QuestieLoader=original; pin('ready',60,40,false); stub.advance(.51); layer:Refresh(map)
    emit({available=layer.available,status=layer:GetStatus(),count=layer.markerCount})
  `);
  assert.equal(a.status, 'Questie not loaded');
  assert.equal(a.count, 0);
  assert.equal(b.status, 'Questie pins not ready');
  assert.equal(c.available, true);
  assert.equal(c.count, 1);
});

test('invalid coordinates, other continents and edge-spilling icons are clipped and frame pooling stays bounded', () => {
  const [s] = run(`
    pin('bad',0/0,40,false)
    pin('edge',0,40,false)
    local elsewhere=pin('elsewhere',50,50,false); elsewhere.UiMapID=1429
    for i=1,700 do pin('many'..i,10+i*.1,50,false) end
    layer:Refresh(map)
    emit({count=layer.markerCount,pool=#layer.Markers,truncated=layer.displayTruncated})
  `);
  assert.equal(s.count, 600);
  assert.equal(s.pool, 600);
  assert.equal(s.truncated, true);
});
