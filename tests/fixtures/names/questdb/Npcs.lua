local Q = Polestar and Polestar.QuestDB
if not (Q and Q.AddData) then return end
local add = Q.AddData

add("npcs", {
[6]={"Kobold Vermin",1429,0,1,47.6,35.1,40},
[448]={"Hogger"},
})
