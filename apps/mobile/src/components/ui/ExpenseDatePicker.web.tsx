import React from 'react';

const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
export default function ExpenseDatePicker({value,maximumDate,onChange}: {value:Date;mode?:string;maximumDate?:Date;onChange:(event:unknown,value?:Date)=>void}) {
  return <input aria-label="Fecha del gasto" type="date" value={localDate(value)} max={maximumDate ? localDate(maximumDate) : undefined}
    style={{width:'100%',minHeight:54,boxSizing:'border-box',border:'1px solid #D3DDEA',borderRadius:16,padding:12,fontSize:16,color:'#082644',background:'#fff'}}
    onChange={event=>{
      const raw=event.currentTarget.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return;
      const date=new Date(`${raw}T12:00:00`);
      if(!Number.isFinite(date.getTime()) || (maximumDate && date>maximumDate && localDate(date)!==localDate(maximumDate)))return;
      onChange(event,date);
    }} />;
}
