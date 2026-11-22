import math, json
NAVY='#16202A'; CREAM='#EFE3C6'; AGED='#D9C8A2'; GOLD='#C79A3E'; BRONZE='#7A5A28'; SLATE='#31404C'; RUST='#A85433'
def f(x): return f"{x:.1f}"
def bust(cx, cy, r, fill, extra=''):
    sy = cy + 1.42*r; base = cy + 3.0*r
    return (f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}" {extra}/>'
            f'<path d="M{f(cx-1.95*r)} {f(base)} C{f(cx-1.95*r)} {f(sy+0.35*r)} {f(cx-1.25*r)} {f(sy)} {f(cx)} {f(sy)} '
            f'C{f(cx+1.25*r)} {f(sy)} {f(cx+1.95*r)} {f(sy+0.35*r)} {f(cx+1.95*r)} {f(base)} Z" fill="{fill}" {extra}/>')
def star(cx, cy, R, rin, rot=-90):
    pts=[]
    for i in range(10):
        a=math.radians(rot+i*36); rr=R if i%2==0 else rin
        pts.append(f"{f(cx+rr*math.cos(a))},{f(cy+rr*math.sin(a))}")
    return " ".join(pts)
def crown(cx, by, w, h, fill, stroke=None, sw=0):
    x0=cx-w/2; x1=cx+w/2
    d=(f"M{f(x0)} {f(by)} L{f(x0)} {f(by-h*0.55)} L{f(x0+w*0.25)} {f(by-h*0.25)} L{f(cx)} {f(by-h)} "
       f"L{f(x1-w*0.25)} {f(by-h*0.25)} L{f(x1)} {f(by-h*0.55)} L{f(x1)} {f(by)} Z")
    s=f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ''
    out=f'<path d="{d}" fill="{fill}"{s}/>'
    br=w*0.075
    for (x,y) in [(x0,by-h*0.55),(cx,by-h),(x1,by-h*0.55)]:
        out+=f'<circle cx="{f(x)}" cy="{f(y-br*0.6)}" r="{f(br)}" fill="{fill}"{s}/>'
    return out
def laurel(cx, cy, R, fill, n=7, a0=105, a1=215, leaf=(26,11)):
    out=''
    for side in (1,-1):
        for i in range(n):
            t=a0+(a1-a0)*i/(n-1)          # degrees, 90 = straight down
            deg = t if side==-1 else 180-t
            a=math.radians(deg)
            x=cx+R*math.cos(a); y=cy+R*math.sin(a)
            tang = deg+90 if side==-1 else deg-90   # direction of travel up the wreath
            for tilt in (-32,32):
                d=math.radians(tang+tilt)
                lx=x+leaf[0]*0.9*math.cos(d); ly=y+leaf[0]*0.9*math.sin(d)
                out+=f'<ellipse cx="{f(lx)}" cy="{f(ly)}" rx="{leaf[0]}" ry="{leaf[1]}" transform="rotate({f(tang+tilt)} {f(lx)} {f(ly)})" fill="{fill}"/>'
        # stem
        pts=[]
        for i in range(n+1):
            t=a0+(a1-a0)*i/n
            deg = t if side==-1 else 180-t
            a=math.radians(deg); pts.append(f"{f(cx+R*math.cos(a))},{f(cy+R*math.sin(a))}")
        out+=f'<polyline points="{" ".join(pts)}" fill="none" stroke="{fill}" stroke-width="7" stroke-linecap="round"/>'
    return out
def stripes_disc(cx, cy, r, cid, colors, outline):
    out=f'<defs><clipPath id="{cid}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath></defs>'
    out+=f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{colors[0]}"/>'
    out+=f'<g clip-path="url(#{cid})">'
    y=cy-r+r*0.42; h=r*0.11; i=0
    while y<cy+r:
        out+=f'<rect x="{cx-r}" y="{f(y)}" width="{2*r}" height="{f(h)}" fill="{colors[1]}"/>'
        y+=h*2.1; h*=1.12
    out+='</g>'
    out+=f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{outline}" stroke-width="14"/>'
    return out

def icon_A():  # Sunset laurel - DYP sibling
    s=f'<rect width="512" height="512" fill="{CREAM}"/>'
    s+=laurel(256,262,190,NAVY,n=6,a0=100,a1=205,leaf=(24,9))
    s+=stripes_disc(256,262,150,'dA',[GOLD,RUST],NAVY)
    s+=f'<defs><clipPath id="cA"><circle cx="256" cy="262" r="143"/></clipPath></defs>'
    s+=f'<g clip-path="url(#cA)">{bust(256,232,50,NAVY)}</g>'
    s+=f'<polygon points="{star(256,96,34,14)}" fill="{GOLD}" stroke="{NAVY}" stroke-width="9" stroke-linejoin="round"/>'
    return s
def icon_B():  # You are the star
    s=f'<rect width="512" height="512" fill="{NAVY}"/>'
    s+=f'<polygon points="{star(256,276,232,98)}" fill="{GOLD}" stroke="{CREAM}" stroke-width="10" stroke-linejoin="round"/>'
    s+=f'<defs><clipPath id="cB"><polygon points="{star(256,276,222,93)}"/></clipPath></defs>'
    s+=f'<g clip-path="url(#cB)">{bust(256,232,42,NAVY)}</g>'
    return s
def icon_C():  # Spotlight crown
    s=f'<rect width="512" height="512" fill="{NAVY}"/>'
    s+=f'<polygon points="206,0 306,0 470,512 42,512" fill="{SLATE}"/>'
    s+=f'<polygon points="226,0 286,0 400,512 112,512" fill="#3E5060"/>'
    s+=f'<ellipse cx="256" cy="452" rx="200" ry="34" fill="{BRONZE}"/>'
    s+=bust(256,268,58,GOLD)
    s+=f'<rect x="80" y="442" width="352" height="70" fill="{GOLD}"/>'
    s+=crown(256,196,108,70,CREAM)
    return s
def icon_D():  # Portrait medallion with sunburst
    s=f'<rect width="512" height="512" fill="{RUST}"/>'
    rays=''
    for i in range(24):
        a0=math.radians(i*15); a1=math.radians(i*15+7.5)
        rays+=f'<polygon points="256,256 {f(256+400*math.cos(a0))},{f(256+400*math.sin(a0))} {f(256+400*math.cos(a1))},{f(256+400*math.sin(a1))}" fill="#B9643F"/>'
    s+=rays
    s+=f'<ellipse cx="256" cy="246" rx="160" ry="196" fill="{GOLD}" stroke="{NAVY}" stroke-width="12"/>'
    s+=f'<ellipse cx="256" cy="246" rx="132" ry="168" fill="{NAVY}" stroke="{BRONZE}" stroke-width="6"/>'
    s+=f'<defs><clipPath id="cD"><ellipse cx="256" cy="246" rx="129" ry="165"/></clipPath></defs>'
    s+=f'<g clip-path="url(#cD)">{bust(256,214,56,CREAM)}</g>'
    # ribbon
    s+=f'<path d="M70 368 L130 368 L120 398 L130 428 L70 428 Z M442 368 L382 368 L392 398 L382 428 L442 428 Z" fill="{BRONZE}" stroke="{NAVY}" stroke-width="8" stroke-linejoin="round"/>'
    s+=f'<path d="M110 352 Q256 380 402 352 L402 412 Q256 440 110 412 Z" fill="{CREAM}" stroke="{NAVY}" stroke-width="10" stroke-linejoin="round"/>'
    s+=f'<polygon points="{star(256,394,16,7)}" fill="{RUST}"/>'
    return s

def svg(body, size, radius, label):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 512 512" role="img" aria-label="{label}" '
            f'style="display: block; border-radius: {radius}px; flex-shrink: 0">{body}</svg>')

concepts=[
 ('A','Sunset Laurel','Sunset laurel concept',icon_A,CREAM),
 ('B','You Are the Star','Star concept',icon_B,NAVY),
 ('C','Spotlight Crown','Spotlight concept',icon_C,NAVY),
 ('D','Portrait Medallion','Medallion concept',icon_D,RUST),
]
HEAD='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&amp;family=Oswald:wght@500;600&amp;family=Barlow:wght@400;600&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:#7A5A28}}a:hover{{color:#16202A}}
</style>
</helmet>
'''
TAIL='''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
W,H=1280,600
boards={}; order=[]
for i,(k,name,label,fn,bg) in enumerate(concepts):
    body=fn()
    big=svg(body,400,88,f'{label}, app icon')
    small=''.join(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 10px">{svg(body,s,round(s*0.22),f"{label} at {s} pixels")}<span style="font-family: Barlow, sans-serif; font-size: 13px; color: #31404C">{s} px</span></div>' for s in (120,60,29))
    lock=(f'<div style="display: flex; align-items: center; gap: 24px; background: #F8F1E0; border: 2px solid #D9C8A2; border-radius: 16px; padding: 28px 32px">'
          f'{svg(body,120,26,label)}'
          f'<div style="display: flex; flex-direction: column; gap: 6px">'
          f'<span style="font-family: \'Alfa Slab One\', serif; font-size: 44px; line-height: 1; color: #16202A; letter-spacing: 1px">LEGEND MAKER</span>'
          f'<span style="font-family: Oswald, sans-serif; font-weight: 600; font-size: 16px; letter-spacing: 4px; color: #7A5A28">BY GOODWOOKIE</span>'
          f'</div></div>')
    html=HEAD.format(title=f'Concept {k}: {name}')
    html+=(f'<div style="width: {W}px; height: {H}px; box-sizing: border-box; padding: 56px 64px; background: #EFE3C6; display: flex; gap: 64px; align-items: center; font-family: Barlow, sans-serif">'
           f'{big}'
           f'<div style="display: flex; flex-direction: column; gap: 40px">'
           f'<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-family: Oswald, sans-serif; font-weight: 600; font-size: 15px; letter-spacing: 3px; color: #7A5A28">CONCEPT {k}</span>'
           f'<h1 style="margin: 0; font-family: Oswald, sans-serif; font-weight: 600; font-size: 40px; color: #16202A">{name}</h1></div>'
           f'<div style="display: flex; gap: 32px; align-items: flex-end">{small}</div>'
           f'{lock}</div></div>\n')
    html+=TAIL.format(w=W,h=H)
    fn_=f'Concept{k}.dc.html' if i else 'Main.dc.html'
    open(f'project/{fn_}','w').write(html)
    boards[fn_]={"x":0,"y":i*(H+120),"w":W,"h":H,"title":f'Concept {k}: {name}'}
    order.append(fn_)
canvas={"v":3,"createdOnFiles":{"v":1,"at":"2026-11-20T18:40:00Z"},"title":"Legend Maker icon and logo","launch":{"view":"canvas"},"pages":[],"boards":boards,"order":order,
 "notes":{"t":{"x":0,"y":-300,"text":"Legend Maker: icon and logo concepts","kind":"title1","maxW":1280}},"designSystems":[]}
json.dump(canvas,open('project/canvas.json','w'),indent=1)
# also standalone preview sheet for my own check
sheet='<html><body style="margin:0;background:#ddd">'+''.join(f'<div style="display:inline-block;margin:10px">{svg(fn(),300,66,l)}</div>' for _,_,l,fn,_ in concepts)+'</body></html>'
open('/tmp/sheet.html','w').write(sheet)

# ---- Round 2: variations of A and B ----
def icon_A2():  # navy night version
    s=f'<rect width="512" height="512" fill="{NAVY}"/>'
    s+=laurel(256,262,190,GOLD,n=6,a0=100,a1=205,leaf=(24,9))
    s+=stripes_disc(256,262,150,'dA2',[GOLD,RUST],CREAM)
    s+=f'<defs><clipPath id="cA2"><circle cx="256" cy="262" r="143"/></clipPath></defs>'
    s+=f'<g clip-path="url(#cA2)">{bust(256,232,50,NAVY)}</g>'
    s+=f'<polygon points="{star(256,96,34,14)}" fill="{CREAM}" stroke="{NAVY}" stroke-width="9" stroke-linejoin="round"/>'
    return s
def icon_A3():  # crown on top, plain gold disc
    s=f'<rect width="512" height="512" fill="{CREAM}"/>'
    s+=laurel(256,270,190,NAVY,n=6,a0=100,a1=205,leaf=(24,9))
    s+=f'<circle cx="256" cy="270" r="150" fill="{GOLD}" stroke="{NAVY}" stroke-width="14"/>'
    s+=f'<defs><clipPath id="cA3"><circle cx="256" cy="270" r="143"/></clipPath></defs>'
    s+=f'<g clip-path="url(#cA3)">{bust(256,246,50,NAVY)}</g>'
    s+=crown(256,150,104,64,GOLD,NAVY,9)
    return s
def icon_B2():  # cream ground, navy star
    s=f'<rect width="512" height="512" fill="{CREAM}"/>'
    s+=f'<polygon points="{star(256,276,232,98)}" fill="{NAVY}" stroke="{GOLD}" stroke-width="12" stroke-linejoin="round"/>'
    s+=f'<defs><clipPath id="cB2"><polygon points="{star(256,276,222,93)}"/></clipPath></defs>'
    s+=f'<g clip-path="url(#cB2)">{bust(256,232,42,GOLD)}</g>'
    return s
def icon_B3():  # star with sunburst behind
    s=f'<rect width="512" height="512" fill="{NAVY}"/>'
    for i in range(20):
        a0=math.radians(i*18-90+4.5); a1=math.radians(i*18-90+13.5)
        s+=f'<polygon points="256,276 {f(256+420*math.cos(a0))},{f(276+420*math.sin(a0))} {f(256+420*math.cos(a1))},{f(276+420*math.sin(a1))}" fill="{SLATE}"/>'
    s+=f'<polygon points="{star(256,276,220,93)}" fill="{GOLD}" stroke="{CREAM}" stroke-width="10" stroke-linejoin="round"/>'
    s+=f'<defs><clipPath id="cB3"><polygon points="{star(256,276,210,88)}"/></clipPath></defs>'
    s+=f'<g clip-path="url(#cB3)">{bust(256,236,40,NAVY)}</g>'
    return s

fams=[('VariationsA.dc.html','Sunset Laurel: variations',[('A','Original',icon_A),('A2','Night',icon_A2),('A3','Crown',icon_A3)]),
      ('VariationsB.dc.html','You Are the Star: variations',[('B','Original',icon_B),('B2','Cream',icon_B2),('B3','Sunburst',icon_B3)])]
VW,VH=1280,560
for fname,title,items in fams:
    cols=''
    for code,nm,fn in items:
        body=fn()
        sm=''.join(svg(body,s,round(s*0.22),f'{code} {nm} at {s} pixels') for s in (60,29))
        cols+=(f'<div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start">'
               f'{svg(body,300,66,f"{code} {nm}, app icon")}'
               f'<div style="display: flex; gap: 16px; align-items: flex-end">{sm}</div>'
               f'<span style="font-family: Oswald, sans-serif; font-weight: 600; font-size: 22px; color: #16202A">{code} · {nm}</span></div>')
    html=HEAD.format(title=title)
    html+=(f'<div style="width: {VW}px; height: {VH}px; box-sizing: border-box; padding: 56px 64px; background: #EFE3C6; display: flex; flex-direction: column; gap: 32px">'
           f'<h1 style="margin: 0; font-family: Oswald, sans-serif; font-weight: 600; font-size: 34px; color: #16202A">{title}</h1>'
           f'<div style="display: flex; gap: 72px">{cols}</div></div>\n')
    html+=TAIL.format(w=VW,h=VH)
    open(f'project/{fname}','w').write(html)
sheet='<html><body style="margin:0;background:#ddd">'+''.join(f'<div style="display:inline-block;margin:10px">{svg(fn(),250,55,"x")}</div>' for fn in (icon_A2,icon_A3,icon_B2,icon_B3))+'</body></html>'
open('/tmp/sheet2.html','w').write(sheet)
