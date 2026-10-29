#!/usr/bin/env python3
"""Compose 32 raster wake frames: night, dawn, ageing tree, desert and wind."""
import importlib.util
import math
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sleep_scene', ROOT/'scripts/generate-rune-wolf-sleep-atlas.py')
base=importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
CELL=320


def blend_palette(t):
    stops=[(0,(190,155,169),(247,204,157)),(.30,(23,31,59),(47,65,86)),
           (.48,(42,47,80),(97,104,133)),(.70,(159,191,206),(249,224,178)),
           (1,(174,200,214),(252,221,171))]
    for (a,top,low),(b,top2,low2) in zip(stops,stops[1:]):
        if t<=b:
            p=base.smooth((t-a)/(b-a))
            return np.array(top)*(1-p)+np.array(top2)*p,np.array(low)*(1-p)+np.array(low2)*p
    return np.array(stops[-1][1]),np.array(stops[-1][2])


def frame(i,garden,decay):
    t=i/31
    if i==0:
        return base.frame(15,garden)
    night=base.smooth(t/.25)*(1-base.smooth((t-.42)/.24))
    original_palette, original_tint=base.sky_palette,base.tint
    original_atmosphere=base.atmosphere
    base.sky_palette=lambda _:blend_palette(t)
    base.tint=lambda image,_:original_tint(image,.16+.68*night)
    def atmosphere(_):
        scene=original_atmosphere(t)
        moon=Image.new('RGBA',(320,320))
        d=ImageDraw.Draw(moon)
        d.ellipse((237,92,265,120),fill=(255,240,189,round(245*(1-night))))
        d.ellipse((226,56,266,96),fill=(248,235,195,round(255*night)))
        alpha=moon.getchannel('A');ImageDraw.Draw(alpha).ellipse((247,51,287,91),fill=0)
        moon.putalpha(alpha)
        scene.alpha_composite(moon)
        dots=Image.new('RGBA',(320,320));d=ImageDraw.Draw(dots);rng=random.Random(822)
        for _ in range(25):
            x,y=rng.randint(45,280),rng.randint(47,200)
            d.ellipse((x,y,x+1,y+1),fill=(234,239,218,round(180*night)))
        scene.alpha_composite(dots)
        return scene
    base.atmosphere=atmosphere
    # The existing authored Stag decay cells supply real leaf and bark changes.
    death=min(10,base.smooth(t/.74)*10)
    a,b=int(death),min(10,int(death)+1)
    def cell(index):
        x,y=index%4*320,index//4*320
        return decay.crop((x,y,x+320,y+320))
    dying=Image.blend(cell(a),cell(b),death-a)
    sheet=garden.copy();sheet.paste(dying,(960,960));sheet.paste(dying,(640,0))
    try:
        scene=base.frame(15,sheet,celestial=False)
    finally:
        base.sky_palette,base.tint,base.atmosphere=original_palette,original_tint,original_atmosphere
    sand=base.smooth((t-.38)/.3)
    dunes=Image.new('RGBA',(320,320));d=ImageDraw.Draw(dunes)
    d.ellipse((21,274,303,307),fill=(211,177,121,round(215*sand)))
    d.arc((34,275,265,303),180,330,fill=(246,218,167,round(210*sand)),width=2)
    d.arc((88,281,294,304),190,330,fill=(165,135,95,round(180*sand)),width=1)
    scene.alpha_composite(dunes)
    wind=base.smooth((t-.70)/.30)
    if wind:
        # Erase the old landscape along irregular wind bands, then scatter sand.
        arr=np.array(scene); yy,xx=np.mgrid[:320,:320]
        threshold=1-wind*1.45
        noise=(np.sin(yy*.31+xx*.07)+np.sin(yy*.17-xx*.11))*.08
        coverage=np.clip((threshold-xx/320+noise)*9,0,1)
        arr[:,:,3]=np.uint8(arr[:,:,3]*coverage)
        scene=Image.fromarray(arr)
        dust=Image.new('RGBA',(320,320));d=ImageDraw.Draw(dust);rng=random.Random(170)
        for _ in range(240):
            x0,y0=rng.uniform(35,230),rng.uniform(190,300)
            x=x0+wind*180;y=y0-wind*45+math.sin(x0*.2+wind*4)*8
            r=rng.uniform(.5,1.8)
            d.ellipse((x,y,x+r*2,y+r),fill=(211,175,116,round(190*math.sin(wind*math.pi))))
        scene.alpha_composite(dust)
    if i==31: return Image.new('RGBA',(320,320))
    return scene


def main():
    garden=Image.open(ROOT/'assets/pixelPet/animations/home_sleep_garden.png').convert('RGBA')
    decay=Image.open(ROOT/'assets/pixelPet/animations/home_sleep_garden_decay.png').convert('RGBA')
    frames=[frame(i,garden,decay) for i in range(32)]
    atlas=Image.new('RGBA',(2560,1280));contact=Image.new('RGB',(2560,1376),'#f7f4ef')
    previews=ROOT/'tasks/previews';previews.mkdir(exist_ok=True,parents=True)
    for i,f in enumerate(frames):
        atlas.alpha_composite(f,((i%8)*320,(i//8)*320))
        x,y=i%8*320,i//8*344
        contact.paste(f,(x,y),f)
        ImageDraw.Draw(contact).text((x+8,y+322),f'{i+1:02d}',fill='#706d69')
    atlas.save(ROOT/'assets/pixelPet/animations/home_wake_rune_wolf.png',optimize=True)
    contact.save(previews/'rune-wolf-wake-frames.png')
    motion=[]
    for i in range(31):
        for j in range(3):
            f=Image.blend(frames[i],frames[i+1],base.smooth(j/3))
            paper=Image.new('RGBA',(320,320),'#f7f4ef');paper.alpha_composite(f)
            motion.append(paper.convert('RGB'))
    motion += [Image.new('RGB',(320,320),'#f7f4ef')]*14
    motion[0].save(previews/'rune-wolf-wake.gif',save_all=True,append_images=motion[1:],duration=80,loop=0,disposal=2)
    print('Saved 32 wake frames, contact sheet and animation preview')


if __name__=='__main__':main()
