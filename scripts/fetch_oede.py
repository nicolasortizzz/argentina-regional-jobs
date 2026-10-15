"""Fetch OEDE/SIPA provincial wages (xlsx) and registered private employment by province (datos.gob.ar 154.1)."""
import json, datetime, warnings; warnings.filterwarnings("ignore")
import datetime as _d, io, requests, pandas as pd
NOW=datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
URL='https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_9.xlsx'
PAGE='https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales'
PROV={'Neuquén':'NEUQUEN','Río Negro':'RIO NEGRO','Mendoza':'MENDOZA','San Juan':'SAN JUAN','Salta':'SALTA','Catamarca':'CATAMARCA','Chubut':'CHUBUT','Santa Cruz':'SANTA CRUZ','CABA':'CAPITAL FEDERAL','Buenos Aires':'BUENOS AIRES','National':'Total'}
SHEET={'Neuquén':'Neuquén','Río Negro':'Río Negro','Mendoza':'Mendoza','San Juan':'San Juan','Salta':'Salta','Catamarca':'Catamarca','Chubut':'Chubut','Santa Cruz':'Santa Cruz','CABA':'CABA','Buenos Aires':'Resto Pcia. Bs. As.','National':'Total'}
SECT={'oil_gas':['11'],'mining':['10','12','13','14'],'construction':['45'],'logistics':['60','63'],'utilities':['40'],'finance':['65','66','67'],'it_services':['72'],'professional_services':['74'],'commerce_retail':['52']}
raw=requests.get(URL,timeout=120).content
x=pd.ExcelFile(io.BytesIO(raw))
tot=pd.read_excel(x,'Total',header=4)
dates=[c for c in tot.columns[1:] if isinstance(c,(pd.Timestamp,datetime.datetime))]
out={'source_url':URL,'source_page':PAGE,'fetched_at':NOW,'unit':'ARS current, monthly average total remuneration, registered private employees (SIPA)','note':'June and December include aguinaldo (SAC); use non-SAC months for comparisons.','provinces':{}}
for k,name in PROV.items():
  row=tot[tot.iloc[:,0].astype(str).str.strip()==name]
  ser=[{'date':str(d.date())[:7],'value':float(row[d].iloc[0])} for d in dates[-48:] if pd.notna(row[d].iloc[0])]
  sh=pd.read_excel(x,SHEET[k],header=None)
  hdr=sh.iloc[3].tolist(); last_regular=None
  for j in range(len(hdr)-1,0,-1):
    if isinstance(hdr[j],(pd.Timestamp,datetime.datetime)) and hdr[j].month not in (6,12): last_regular=j;break
  sec={}
  for sk,codes in SECT.items():
    vals=[]
    for i in range(4,len(sh)):
      if str(sh.iat[i,0]).strip() in codes:
        v=sh.iat[i,last_regular]
        if isinstance(v,(int,float)) and pd.notna(v): vals.append((str(sh.iat[i,0]).strip(),str(sh.iat[i,1]).strip(),float(v)))
    if vals: sec[sk]={'month':str(hdr[last_regular].date())[:7],'items':[{'code':c,'name':n,'value':v} for c,n,v in vals],'max':max(v for *_,v in vals)}
  out['provinces'][k]={'oede_label':name,'series':ser,'sectors':sec}
json.dump(out,open('data/oede_wages.json','w'),ensure_ascii=False,indent=1)
# employment
EMP={'Neuquén':'154.1_NUENUEN_C_0_0_7','Río Negro':'154.1_RNEGROGRO_C_0_0_9','Mendoza':None,'San Juan':'154.1_SJUANUAN_C_0_0_8','Salta':'154.1_SALTA_C_0_0_5','Catamarca':'154.1_CMARCARCA_C_0_0_9','Chubut':None,'Santa Cruz':'154.1_SA_CRUZRUZ_C_0_0_10','Buenos Aires':'154.1_BOS_AIRRES_C_0_0_12','CABA':None}
for k in [k for k,v in EMP.items() if v is None]:
  q={'Mendoza':'Provincia de Mendoza','Chubut':'Provincia de Chubut','CABA':'Ciudad Autónoma'}[k]
  r=requests.get('https://apis.datos.gob.ar/series/api/search/',params={'q':'Asalariados sector privado '+q,'limit':30},timeout=60).json()
  for d in r['data']:
    f=d['field']
    if f['id'].startswith('154.1_') and q.split()[-1].lower()[:5] in f['description'].lower(): EMP[k]=f['id'];break
emp={'source':'SIPA registered private-sector employees by province (seasonal, thousands), Secretaría de Trabajo via datos.gob.ar','fetched_at':NOW,'provinces':{}}
for k,i in EMP.items():
  if not i: continue
  r=requests.get('https://apis.datos.gob.ar/series/api/series/',params={'ids':i,'format':'json','limit':5000},timeout=60).json()
  emp['provinces'][k]={'id':i,'source_url':'https://apis.datos.gob.ar/series/api/series/?ids='+i,'points':[{'date':a[0][:7],'value':a[1]} for a in r['data'] if a[1] is not None]}
json.dump(emp,open('data/sipa_employment.json','w'),ensure_ascii=False,indent=1)
print('ok',list(emp['provinces']))
