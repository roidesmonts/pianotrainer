import type { MorceauMidi, NoteMidi, PisteMidi } from '../types/midi'
import type { Finger, Hand } from '../fingering/model'

export type MainExercice = 'libre' | 'droite' | 'gauche' | 'deux'
export interface Exercice { id:string; niveau:1|2|3; titre:string; objectif:string; main:MainExercice; difficulte:number; tempo:number; morceau:MorceauMidi }
type Def = Omit<Exercice,'id'|'morceau'> & { hauteurs:number[]; durees?:number[] }
const noms=['Do','Do♯','Ré','Ré♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si']
const nom=(m:number)=>`${noms[m%12]}${Math.floor(m/12)-1}`

function morceau(d:Def):MorceauMidi {
  const identite=`exercise-v1-${d.titre.toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,'-')}`
  const unite=60/d.tempo, notes:NoteMidi[]=[], pistes:PisteMidi[]=d.main==='deux'
    ? [{id:'droite',index:0,nom:'Main droite',canal:0,instrument:'Piano',nombreNotes:0},{id:'gauche',index:1,nom:'Main gauche',canal:1,instrument:'Piano',nombreNotes:0}]
    : [{id:d.main,index:0,nom:d.main==='droite'?'Main droite':d.main==='gauche'?'Main gauche':'Exploration',canal:0,instrument:'Piano',nombreNotes:0}]
  let t=0
  d.hauteurs.forEach((h,i)=>{ const longueur=d.durees?.[i%d.durees.length]??1
    const ajouter=(m:number,p:number)=>{const main:Hand=d.main==='gauche'||(d.main==='deux'&&p===1)?'left':d.main==='droite'||d.main==='deux'?'right':m<60?'left':'right';const doigt=(main==='right'?i%5+1:5-i%5) as Finger;notes.push({id:`${identite}:${p}:${t*480}:${m}`,midi:m,nom:nom(m),temps:t*unite,duree:longueur*unite*.88,velocite:.72,ticks:t*480,dureeTicks:longueur*480,pisteId:pistes[p].id,pisteIndex:p,main,doigt,confiance:d.main==='libre'?.4:.95,origineDoigte:d.main==='libre'?'heuristic':'source'})}
    if(d.main==='deux'){ajouter(h+12,0);ajouter(h-12,1)}else ajouter(h+(d.main==='gauche'?-12:0),0);t+=longueur })
  notes.sort((a,b)=>a.temps-b.temps||a.midi-b.midi); pistes.forEach((p,i)=>p.nombreNotes=notes.filter(n=>n.pisteIndex===i).length)
  const duree=t*unite,min=Math.min(...notes.map(n=>n.midi)),max=Math.max(...notes.map(n=>n.midi))
  return {nomInterne:d.titre,duree,dureeTicks:t*480,ppq:480,tempoInitial:d.tempo,tempos:[{bpm:d.tempo,ticks:0,temps:0}],
    signaturesRythmiques:[{numerateur:4,denominateur:4,ticks:0,temps:0}],mesures:Array.from({length:Math.ceil(t/4)},(_,i)=>({numero:i+1,ticks:i*1920,temps:i*4*unite,signature:'4/4'})),
    identite,pistes,notes,etendue:{min,max,nomMin:nom(min),nomMax:nom(max)}}
}
const H={rep:[60,60,60,60,60,60,60,60],deux:[60,62,60,62,60,62,60,62],trois:[60,62,64,62,60,62,64,60],gamme:[60,62,64,65,67,65,64,62,60],tierces:[60,64,62,65,64,67,64,62,60]}
const blanches=Array.from({length:88},(_,i)=>i+21).filter(m=>![1,3,6,8,10].includes(m%12))
const chromatique=Array.from({length:88},(_,i)=>i+21)
const defs:Def[]=[
 {niveau:1,titre:'Traversée du clavier',objectif:'Jouer toutes les touches blanches de gauche à droite.',main:'libre',difficulte:1,tempo:72,hauteurs:blanches,durees:[.5]},
 {niveau:1,titre:'Retour du clavier',objectif:'Revenir de droite à gauche sur les touches blanches.',main:'libre',difficulte:1,tempo:72,hauteurs:[...blanches].reverse(),durees:[.5]},
 {niveau:1,titre:'Tous les Do',objectif:'Retrouver chaque Do sur toute l’étendue.',main:'libre',difficulte:1,tempo:55,hauteurs:blanches.filter(m=>m%12===0)},
 {niveau:1,titre:'Repères Do–Fa',objectif:'Alterner les deux principaux repères visuels.',main:'libre',difficulte:2,tempo:60,hauteurs:blanches.filter(m=>m%12===0||m%12===5)},
 {niveau:1,titre:'Traversée chromatique',objectif:'Découvrir les touches blanches et noires dans l’ordre.',main:'libre',difficulte:2,tempo:80,hauteurs:chromatique,durees:[.5]},
 {niveau:1,titre:'Chasse aux notes',objectif:'Retrouver des notes éloignées sur tout le clavier.',main:'libre',difficulte:3,tempo:48,hauteurs:[48,72,36,84,60,43,79,55,67,31,91,52,76,40,64]},
 {niveau:2,titre:'Cinq doigts main droite',objectif:'Monter et descendre sans déplacer la main.',main:'droite',difficulte:1,tempo:55,hauteurs:H.gamme},
 {niveau:2,titre:'Cinq doigts main gauche',objectif:'Installer les cinq doigts de la main gauche.',main:'gauche',difficulte:1,tempo:52,hauteurs:H.gamme},
 {niveau:2,titre:'Petits sauts main droite',objectif:'Lire et jouer les tierces.',main:'droite',difficulte:2,tempo:55,hauteurs:H.tierces},
 {niveau:2,titre:'Petits sauts main gauche',objectif:'Préparer les accompagnements.',main:'gauche',difficulte:2,tempo:52,hauteurs:H.tierces},
 {niveau:3,titre:'Mains parallèles',objectif:'Déplacer les deux mains ensemble.',main:'deux',difficulte:2,tempo:48,hauteurs:H.gamme},
 {niveau:3,titre:'Noires et blanches',objectif:'Synchroniser des durées différentes.',main:'deux',difficulte:3,tempo:50,hauteurs:H.gamme,durees:[1,1,2,1,1,2]},
 {niveau:3,titre:'Mini étude',objectif:'Enchaîner lecture, rythme et coordination.',main:'deux',difficulte:4,tempo:52,hauteurs:[60,62,64,65,67,64,65,62,60,64,67,65,64,62,60],durees:[1,.5,.5,1,1,.5,.5,1,2,1,1,.5,.5,1,2]},
]
export const exercices:Exercice[]=defs.map((d,i)=>({...d,id:`exercice-${i+1}`,morceau:morceau(d)}))
