// Dedicated Cloudflare Cron Worker: process durable HiFi campaign batches.
export default {
 async scheduled(_event, env, ctx) {
  ctx.waitUntil(processQueue(env))
 },
}
async function processQueue(env) {
 const token=env.BULK_WORKER_TOKEN
 const base=env.SURVEY_BASE_URL
 if(!token||token.length<32||!base)throw Error('BULK_WORKER_TOKEN or SURVEY_BASE_URL is missing')
 const headers={Authorization:'Bearer '+token}
 const next=await fetch(base+'/api/upload/bulk?mode=next',{headers})
 if(!next.ok)throw Error('Unable to find queued campaign: '+next.status)
 const {job_id}=await next.json()
 if(!job_id)return
 let completed=0
 for(let i=0;i<10;i++){
  const response=await fetch(base+'/api/upload/bulk',{
   method:'POST',
   headers:{...headers,'Content-Type':'application/json','Origin':new URL(base).origin},
   body:JSON.stringify({action:'process',job_id}),
  })
  if(!response.ok)throw Error('Process batch failed: '+response.status)
  const result=await response.json()
  if(result.complete||result.busy)break
  if(result.processed)completed++
 }
 console.log('Processed HiFi bulk batches:',completed)
}
