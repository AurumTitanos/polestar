'use strict';
// Actual addon frames over synthetic player, quest and terrain fixtures.
// No client artwork, purchased guides or installed-addon files are read.
const files = ['Core/Core.xml', 'Theme/Theme.xml', 'Maps/RouteStrokes.lua', 'UI/UI.xml'];
const setup = `uistub.install(); livestub.install()
C_QuestLog = C_QuestLog or {}
C_QuestLog.GetNumQuestLogEntries=function() return 1,1 end
C_QuestLog.GetInfo=function() return {questID=70001,title="Sample supplies",isHeader=false} end
C_QuestLog.GetQuestObjectives=function() return {{text="Gather supplies",numFulfilled=2,numRequired=5,finished=false}} end
C_QuestLog.ReadyForTurnIn=function() return false end
C_QuestLog.GetMaxNumQuestsCanAccept=function() return 40 end`;
function scene(name, width, height, compact = false, extra = '') {
 const module = compact ? 'LiveMiniMap' : 'LiveDashboard';
 const setting = compact ? 'liveMiniMap' : 'liveDashboard';
 return {
  file: `live-${name}.svg`,
  title: `Native ${compact ? 'compact map' : 'Planner'}: ${name}; actual addon Lua with synthetic character, quest and flat terrain fixtures`,
  panels: [{
   files, stubs: ['stub_ui.lua', 'live-dashboard.lua'], setup,
   roots: [`Polestar${module}`, ...(extra.includes('ShowOptions') ? ['PolestarMenu'] : [])],
   script: `uistub.setGuide(uistub.elwynn,3)
Polestar.Set("${setting}.width",${width}); Polestar.Set("${setting}.height",${height})
local D=Polestar.${module}; D.Show(); local F=D.GetFrame()
-- The real client derives sizes from anchors; the generic polling stub
-- only stores those anchors. The renderer still solves their actual layout.
${compact ? '' : 'F.List:SetHeight(F:GetHeight()-188)'}
F.Map.Viewport:SetSize(F.Map:GetWidth(),F.Map:GetHeight()-${compact ? 0 : 103})
F.Map.View=false; F.Map:Refresh(true)
${extra}
D.Refresh(true)
for i,tile in ipairs(F.Map.Tiles) do
 if tile:IsShown() then tile:SetColorTexture(0.10+(i%2)*0.02,0.19+(i%2)*0.02,0.16,1) end
end`,
  }],
 };
}
module.exports = [
 scene('planner', 1080, 760),
 scene('planner-minimum', 850, 600),
 scene('planner-browsing', 1080, 760, false, 'D.SelectStep(7)'),
 scene('compact-map', 420, 380, true),
 scene('compact-map-minimum', 320, 180, true),
 scene('compact-map-options', 420, 380, true, 'D.ShowOptions()'),
];
