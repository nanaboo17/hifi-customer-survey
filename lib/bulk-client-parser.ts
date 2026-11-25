// Browser-only CSV/XLSX reader for up to 500,000 distinct customers.
export type BulkCustomer = { customer_id:string; customer_name:string; phone_number:string }
const LIMIT=500000
const normalize = (header:string[]) => {
 const h=header.map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s-]+/g,'_'))
 const id=h.findIndex(x=>['customer_id','customerid','cust_id','id'].includes(x))
 const name=h.findIndex(x=>['customer_name','customername','nama_pelanggan','nama','name'].includes(x))
 const phone=h.findIndex(x=>['phone_number','phone','msisdn','no_hp','whatsapp'].includes(x))
 if(id<0||name<0||phone<0)throw Error('Kolom customer_id, customer_name, dan phone_number wajib ada')
 return {id,name,phone}
}
function mapped(rows:string[][]):BulkCustomer[]{
 if(rows.length<2)throw Error('File kosong')
 const ix=normalize(rows[0]), customers:BulkCustomer[]=[]
 for(let i=1;i<rows.length;i++) {
  const r=rows[i]
  if(!r.some(x=>x?.trim()))continue
  customers.push({customer_id:(r[ix.id]||'').trim(),customer_name:(r[ix.name]||'').trim(),phone_number:(r[ix.phone]||'').trim()})
 }
 if(customers.length>LIMIT)throw Error('Maksimal 500.000 pelanggan')
 return customers
}
async function parseCsv(file:File):Promise<BulkCustomer[]> {
 const reader=file.stream().getReader(),decoder=new TextDecoder()
 const customers:BulkCustomer[]=[], seen=new Set<string>()
 let header:{id:number;name:number;phone:number}|null=null
 const headerLine=(await file.slice(0,4096).text()).split(/\r?\n/,1)[0]
 const delimiter=headerLine.split(';').length>headerLine.split(',').length?';':','
 let field='',row:string[]=[],quoted=false,first=true,pendingQuote=false,previousCR=false
 const finishRow=()=>{
  if(!row.length&&!field)return
  row.push(field);field=''
  if(!header){header=normalize(row);row=[];return}
  if(row.every(x=>!x.trim())){row=[];return}
  const id=(row[header.id]||'').trim(),name=(row[header.name]||'').trim(),phone=(row[header.phone]||'').trim()
  if(!id||!name||!phone)throw Error('Kolom kosong pada baris '+(customers.length+2))
  if(seen.has(id))throw Error('Customer ID duplikat pada file: '+id)
  seen.add(id)
  customers.push({customer_id:id,customer_name:name,phone_number:phone})
  if(customers.length>LIMIT)throw Error('Maksimal 500.000 pelanggan')
  row=[]
 }
 // Stream the content rather than loading the entire 100 MB CSV as one string.
 while(true){
  const {done,value}=await reader.read()
  if(done)break
  const input=decoder.decode(value,{stream:true})
  for(let i=0;i<input.length;i++){
   const c=input[i]
   if(first){first=false;if(c==='\uFEFF')continue}
   if(previousCR){previousCR=false;if(c==='\n')continue}
   if(quoted){
    if(pendingQuote){
     pendingQuote=false
     if(c==='"'){field+='"';continue}
     quoted=false
    }else if(c==='"'){pendingQuote=true;continue}
    else{field+=c;continue}
   }
   if(c==='"' && !field){quoted=true}
   else if(c===delimiter){row.push(field);field=''}
   else if(c==='\r'||c==='\n'){finishRow();if(c==='\r')previousCR=true}
   else field+=c
  }
 }
 field+=decoder.decode()
 if(quoted&&!pendingQuote)throw Error('CSV memiliki tanda kutip tidak tertutup')
 if(pendingQuote){quoted=false;pendingQuote=false}
 finishRow()
 if(!header||!customers.length)throw Error('Tidak ada pelanggan dalam file')
 return customers
}
async function parseXlsx(file:File):Promise<BulkCustomer[]>{
 const buffer=await file.arrayBuffer(),v=new DataView(buffer),bytes=new Uint8Array(buffer),decoder=new TextDecoder(),parts=new Map<string,string>()
 const u16=(i:number)=>v.getUint16(i,true),u32=(i:number)=>v.getUint32(i,true)
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(i)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw Error('File XLSX tidak valid')
 let pos=u32(eocd+16),total=0
 for(let i=0;i<u16(eocd+10);i++){
  if(u32(pos)!==0x02014b50)throw Error('ZIP directory tidak valid')
  const method=u16(pos+10),compressed=u32(pos+20),size=u32(pos+24),nameLength=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42)
  const name=decoder.decode(bytes.slice(pos+46,pos+46+nameLength));pos+=46+nameLength+extra+comment
  if(name!=='xl/sharedStrings.xml'&&!/^xl\/worksheets\/sheet\d+\.xml$/.test(name))continue
  if(size>250000000||compressed>100000000||u32(offset)!==0x04034b50)throw Error('File Excel terlalu besar')
  const start=offset+30+u16(offset+26)+u16(offset+28),data=bytes.slice(start,start+compressed);let result:Uint8Array
  if(method===0)result=data
  else if(method===8){const output=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));result=new Uint8Array(await new Response(output).arrayBuffer())}
  else throw Error('Kompresi XLSX tidak didukung')
  total+=result.length;if(total>350000000)throw Error('Excel terlalu besar setelah diekstrak; gunakan CSV')
  parts.set(name,decoder.decode(result))
 }
 const parse=(xml:string)=>{const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('XML Excel tidak valid');return doc}
 const shared=parts.get('xl/sharedStrings.xml')?Array.from(parse(parts.get('xl/sharedStrings.xml')!).getElementsByTagName('si')).map(x=>x.textContent||''):[]
 const sheet=[...parts.keys()].filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort()[0]
 if(!sheet)throw Error('Worksheet tidak ditemukan')
 const xmlRows=Array.from(parse(parts.get(sheet)!).getElementsByTagName('row'))
 if(xmlRows.length>LIMIT+1)throw Error('Maksimal 500.000 pelanggan')
 const rows=xmlRows.map(r=>{const row:string[]=[]
  for(const c of Array.from(r.getElementsByTagName('c'))){
   const ref=c.getAttribute('r')?.match(/^[A-Z]+/)?.[0]||'A'
   let index=0;for(const char of ref)index=index*26+char.charCodeAt(0)-64;index--
   if(index>30)continue
   const raw=c.getElementsByTagName('v')[0]?.textContent||''
   row[index]=c.getAttribute('t')==='s'?(shared[Number(raw)]||''):c.getAttribute('t')==='inlineStr'?(c.getElementsByTagName('is')[0]?.textContent||''):raw
  }return row
 })
 const customers=mapped(rows),seen=new Set<string>()
 for(const c of customers){if(!c.customer_id||!c.customer_name||!c.phone_number)throw Error('Baris dengan data pelanggan tidak lengkap');if(seen.has(c.customer_id))throw Error('Customer ID duplikat: '+c.customer_id);seen.add(c.customer_id)}
 return customers
}
export async function parseBulk(file:File):Promise<BulkCustomer[]>{
 if(file.size>100000000)throw Error('Maksimal ukuran file 100 MB')
 const name=file.name.toLowerCase()
 if(name.endsWith('.csv'))return parseCsv(file)
 if(name.endsWith('.xlsx'))return parseXlsx(file)
 throw Error('Gunakan CSV atau XLSX')
}
