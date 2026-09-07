(()=>{'use strict';
const mobile=matchMedia('(max-width:640px)').matches;
function optimize(){
 const c=document.getElementById('wheel');
 if(mobile&&c&&(c.width>760||c.height>760)){c.width=720;c.height=720;}
 document.documentElement.style.overflowY='auto';document.body.style.overflowY='auto';
 document.querySelectorAll('.d13-details').forEach(d=>{if(mobile)d.open=false});
}
addEventListener('DOMContentLoaded',optimize,{once:true});
const target=document.getElementById('resultDetails');
if(target){new MutationObserver(()=>{if(!mobile)return;document.querySelectorAll('.d13-details').forEach(d=>d.open=false)}).observe(target,{childList:true,subtree:true});}
})();