import math, subprocess, os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'gen.py')).read().split('def svg(')[0])   # geometry helpers + icons A-D
FONTS='/home/claude/legendmaker/node_modules/@expo-google-fonts'
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'out')
def rays(cx,cy,n=20,col=SLATE,L=900):
    s=''
    for i in range(n):
        a0=math.radians(i*360/n-90+360/n/4); a1=math.radians(i*360/n-90+3*360/n/4)
        s+=f'<polygon points="{cx},{cy} {f(cx+L*math.cos(a0))},{f(cy+L*math.sin(a0))} {f(cx+L*math.cos(a1))},{f(cy+L*math.sin(a1))}" fill="{col}"/>'
    return s
def gold_star(cx,cy,R,stroke=CREAM,bustcol=NAVY,sw=None,uid='s'):
    sw=sw or R*0.045; rin=R*0.423
    s=f'<polygon points="{star(cx,cy,R,rin)}" fill="{GOLD}" stroke="{stroke}" stroke-width="{f(sw)}" stroke-linejoin="round"/>'
    s+=f'<defs><clipPath id="{uid}"><polygon points="{star(cx,cy,R*0.955,rin*0.955)}"/></clipPath></defs>'
    s+=f'<g clip-path="url(#{uid})">{bust(cx,cy-R*0.182,R*0.182,bustcol)}</g>'
    return s
def cut_star(cx,cy,R,col,uid='m'):  # single ink: star with person cut out
    rin=R*0.423
    return (f'<defs><mask id="{uid}"><rect width="1024" height="1024" fill="white"/>{bust(cx,cy-R*0.182,R*0.182,"black")}</mask></defs>'
            f'<polygon points="{star(cx,cy,R,rin)}" fill="{col}" stroke="{col}" stroke-width="{f(R*0.045)}" stroke-linejoin="round" mask="url(#{uid})"/>')
def page(svgbody,w,h):
    return f'''<html><head><style>
@font-face{{font-family:Alfa;src:url(file://{FONTS}/alfa-slab-one/400Regular/AlfaSlabOne_400Regular.ttf)}}
@font-face{{font-family:Osw;src:url(file://{FONTS}/oswald/600SemiBold/Oswald_600SemiBold.ttf)}}
html,body{{margin:0;background:transparent}}</style></head><body>
<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" style="display:block">{svgbody}</svg></body></html>'''
def render(name,body,w,h):
    p=f'/tmp/r_{name}.html'; open(p,'w').write(page(body,w,h))
    subprocess.run(['timeout','60','google-chrome','--headless','--no-sandbox','--disable-gpu','--hide-scrollbars',
        '--default-background-color=00000000',f'--window-size={w},{h}',f'--screenshot={OUT}/{name}.png',f'file://{p}'],
        stderr=subprocess.DEVNULL,stdout=subprocess.DEVNULL)
    # keep an SVG master too
    open(f'{OUT}/{name}.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>')
S=1024; C=512
full=f'<rect width="{S}" height="{S}" fill="{NAVY}"/>'+rays(C,552)+gold_star(C,552,440,uid='i')
render('icon',full,S,S)
render('android-icon-background',f'<rect width="{S}" height="{S}" fill="{NAVY}"/>'+rays(C,C),S,S)
FR=300; fy=C+round(FR*0.095)
render('android-icon-foreground',gold_star(C,fy,FR,uid='fg'),S,S)
render('android-icon-monochrome',cut_star(C,fy,FR,'#FFFFFF'),S,S)
render('splash-icon',gold_star(C,C+44,465,uid='sp'),S,S)
render('star-navy-icon',cut_star(C,C+44,465,NAVY,'mn'),S,S)
render('star-gold-icon',gold_star(C,C+44,455,stroke=NAVY,uid='sg'),S,S)
# logo lockups (horizontal and stacked), transparent
def tile(x,y,size,uid):
    k=size/1024
    return (f'<g transform="translate({x},{y}) scale({k})"><clipPath id="{uid}c"><rect width="1024" height="1024" rx="225"/></clipPath>'
            f'<g clip-path="url(#{uid}c)"><rect width="1024" height="1024" fill="{NAVY}"/>{rays(512,552)}{gold_star(512,552,440,uid=uid)}</g></g>')
lock=(tile(20,20,360,'lh')+
      f'<text x="430" y="200" font-family="Alfa" font-size="112" fill="{NAVY}" letter-spacing="2">LEGEND MAKER</text>'
      f'<text x="436" y="292" font-family="Osw" font-size="46" fill="{BRONZE}" letter-spacing="12">BY GOODWOOKIE</text>')
render('logo-horizontal',lock,1640,400)
stack=(tile(220,20,360,'ls')+
      f'<text x="400" y="520" text-anchor="middle" font-family="Alfa" font-size="84" fill="{NAVY}" letter-spacing="2">LEGEND MAKER</text>'
      f'<text x="400" y="590" text-anchor="middle" font-family="Osw" font-size="36" fill="{BRONZE}" letter-spacing="10">BY GOODWOOKIE</text>')
render('logo-stacked',stack,800,620)
stack_d=(tile(220,20,360,'ld')+
      f'<text x="400" y="520" text-anchor="middle" font-family="Alfa" font-size="84" fill="{CREAM}" letter-spacing="2">LEGEND MAKER</text>'
      f'<text x="400" y="590" text-anchor="middle" font-family="Osw" font-size="36" fill="{GOLD}" letter-spacing="10">BY GOODWOOKIE</text>')
render('logo-stacked-on-navy',stack_d,800,620)
lock_d=(tile(20,20,360,'lhd')+
      f'<text x="430" y="200" font-family="Alfa" font-size="112" fill="{CREAM}" letter-spacing="2">LEGEND MAKER</text>'
      f'<text x="436" y="292" font-family="Osw" font-size="46" fill="{GOLD}" letter-spacing="12">BY GOODWOOKIE</text>')
render('logo-horizontal-on-navy',lock_d,1640,400)
