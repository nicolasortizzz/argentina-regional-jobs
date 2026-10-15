"""Build data/your_options.json: role x sector x province options for an early semi-senior finance/data profile."""
import json
FX=1535.0; FXD='2026-10-15'
R='https://tendenciasytalento.randstad.com.ar/hubfs/Reporte%20Salarial/Reporte%20Salarial%20Julio%202026%20_%20Randstad%20Argentina.pdf'
# Randstad Reporte Salarial Julio 2026: semi-senior gross monthly min-max (values as of 30 Jun 2026), by region x industry
RS={('control','Patagonia','O&G/Mining'):(4190500,5529301),('control','Patagonia','Manufacturing'):(4468733,5820525),
('control','Cuyo','O&G/Mining'):(2950112,3892628),('control','Buenos Aires','O&G/Mining'):(3352400,4423441),
('bi','Patagonia','O&G/Mining'):(4548087,5002895),('bi','Cuyo','O&G/Mining'):(4184240,4602664),('bi','Buenos Aires','O&G/Mining'):(4548087,5002895),
('finance','Patagonia','O&G/Mining'):(3351799,4906561),('accounting','Patagonia','O&G/Mining'):(3256599,4286925),
('treasury','Patagonia','O&G/Mining'):(3511865,4569673)}
ROLE={'control':'Management Control / FP&A analyst','bi':'BI Analyst','finance':'Financial analyst (admin & finance)','accounting':'Accounting analyst / junior controller','treasury':'Treasury analyst'}
CBTF=519578.43/423531.8
CBT={'Patagonia':round(496521.82*CBTF),'Cuyo':round(399607.68*CBTF),'Pampeana':round(417680.63*CBTF)}
PROV={'Neuquén':('Patagonia','Patagonia',1037500,True,'Neuquén city, Reporte Inmobiliario Aug 2026'),
'Santa Cruz':('Patagonia','Patagonia',420000,False,'Río Gallegos, undocumented placeholder'),
'Chubut':('Patagonia','Patagonia',600000,True,'Comodoro Rivadavia, ACACE Aug 2026'),
'Río Negro':('Patagonia','Patagonia',1328335,True,'Bariloche, Reporte Inmobiliario Aug 2026 (upper bound for Alto Valle)'),
'Mendoza':('Cuyo','Cuyo',833330,True,'Mendoza city, Reporte Inmobiliario Aug 2026'),
'CABA':('Buenos Aires','Pampeana',898154,True,'Zonaprop Sep 2026')}
BR=[(2000000,0),(2500000,.05),(3500000,.09),(5000000,.13),(8000000,.17),(None,.21)]
def tax(t):
  x=0;prev=0
  for cap,r in BR:
    c=float('inf') if cap is None else cap; x+=max(0,min(t,c)-prev)*r; prev=c
    if t<=c: break
  return x
def net(g,pat):
  ss=g*.17;t=g-ss
  if pat:t*=0.78
  return g-ss-tax(t)
OPTS=[('Neuquén','control','O&G/Mining','Oil & gas operators (e.g. YPF, Vista, Pampa, Tecpetrol, PAE) and oilfield services'),
('Neuquén','bi','O&G/Mining','Oil & gas operators / oilfield services data & BI teams'),
('Neuquén','accounting','O&G/Mining','Oil & gas accounting / cost control'),
('Neuquén','treasury','O&G/Mining','Oil & gas treasury'),
('Santa Cruz','control','O&G/Mining','Gold/silver mining operations (cost control) and conventional oil'),
('Chubut','control','Manufacturing','Primary aluminium (Puerto Madryn) cost & management control'),
('Chubut','control','O&G/Mining','Golfo San Jorge oil operators (Comodoro Rivadavia)'),
('Río Negro','control','O&G/Mining','Alto Valle oil & gas / services (Cipolletti, Allen)'),
('Mendoza','control','O&G/Mining','Cuyo oil & gas / mining'),
('Mendoza','bi','O&G/Mining','Cuyo oil & gas / mining BI'),
('CABA','control','O&G/Mining','Energy HQ finance teams (benchmark)'),
('CABA','bi','O&G/Mining','Energy HQ BI (benchmark)')]
OEDE=json.load(open('data/oede_wages.json'))['provinces']
rows=[]
for p,role,ind,emp in OPTS:
  reg,cbtreg,rent,rdoc,rsrc=PROV[p]; lo,hi=RS[(role,reg,ind)]
  g=lo+0.25*(hi-lo); pat=reg=='Patagonia'
  n=net(g,pat); cost=rent+CBT[cbtreg]; s=n-cost
  sec=OEDE.get(p,{}).get('sectors',{}); oede={k:sec[k]['max'] for k in ('oil_gas','mining','finance','it_services') if k in sec}
  rows.append(dict(province=p,role=ROLE[role],industry=ind,employers=emp,randstad_region=reg,randstad_min=lo,randstad_max=hi,
   gross_est=round(g),net=round(n),rent=rent,rent_documented=rdoc,rent_source=rsrc,cbt_adult=CBT[cbtreg],costs=round(cost),savings=round(s),
   gross_usd=round(g/FX),savings_usd=round(s/FX),oede_sector_avg_may2026={k:round(v) for k,v in oede.items()}))
rows.sort(key=lambda r:-r['savings'])
out=dict(fx=dict(rate=FX,date=FXD,source='dolarapi.com official (BCRA API unavailable at fetch)'),
 salary_source=dict(name='Randstad Argentina, Reporte Salarial Julio 2026 (semi-senior, gross monthly, min-max, as of 30 Jun 2026)',url=R),
 method='Gross estimate = Randstad semi-senior min + 25% of the min-max range (ESTIMATE for an early semi-senior profile). Randstad publishes by region (Patagonia/Cuyo/Buenos Aires), not province. Net = gross - 17% employee contributions - simplified Ganancias (Patagonia 22% deduction). Costs = rent (single 2-room) + INDEC CBT per adult equivalent, Aug 2026 estimate (regional Dec 2025 x national growth).',
 cbt=CBT,options=rows)
json.dump(out,open('data/your_options.json','w'),ensure_ascii=False,indent=1)
for i,r in enumerate(rows,1): print(i,r['province'],r['role'][:22],r['industry'],r['gross_est'],r['gross_usd'],r['net'],r['costs'],r['savings'],r['savings_usd'],'' if r['rent_documented'] else 'RENT EST')
