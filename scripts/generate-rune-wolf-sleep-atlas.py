#!/usr/bin/env python3
"""Compose 16 raster sleep-scene frames from LifeMate's illustrated garden art.

Requires Pillow/numpy. Reuses the existing Stag garden's growing plants and
painted bark, then adds a raster atmosphere, moss light and ancient stones.
No image-generation service or live SVG is used.
"""
from __future__ import annotations
import argparse
import math
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CELL = 320
ROOT = Path(__file__).resolve().parents[1]


def smooth(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)


def tint(image, night):
    a = np.array(image.convert('RGBA'), dtype=np.float32)
    # Preserve the source's painted highlights and dark bark; moonlight cools them.
    a[:, :, :3] = a[:, :, :3] * (1 - night * np.array([.48, .25, .05]))
    a[:, :, :3] += night * np.array([5, 9, 19])
    return Image.fromarray(np.uint8(np.clip(a, 0, 255)))


def glow(image, xy, radius, color, strength):
    layer = Image.new('RGBA', image.size)
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(*color, round(strength)))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius * .7)))


def sky_palette(p):
    # Remain in warm late-afternoon light throughout the growth sequence.
    stops = [
        (0.0, (150, 183, 201), (247, 227, 186)),
        (.5, (182, 166, 182), (249, 217, 170)),
        (1.0, (190, 155, 169), (247, 204, 157)),
    ]
    for (a, top_a, bottom_a), (b, top_b, bottom_b) in zip(stops, stops[1:]):
        if p <= b:
            t = smooth((p-a)/(b-a))
            return (np.array(top_a)*(1-t)+np.array(top_b)*t,
                    np.array(bottom_a)*(1-t)+np.array(bottom_b)*t)
    return np.array(stops[-1][1]), np.array(stops[-1][2])


def atmosphere(p):
    n = smooth(p)
    y, x = np.mgrid[:CELL, :CELL]
    # Fill the entire scene frame so the sleeping pet is surrounded by night sky.
    alpha = np.ones((CELL, CELL), dtype=np.float32)
    top, bottom = sky_palette(p)
    f = np.clip((y-70)/240, 0, 1)[..., None]
    rgb = top*(1-f)+bottom*f
    image = Image.fromarray(np.uint8(np.dstack([rgb, alpha*255])))
    hills = Image.new('RGBA', (CELL, CELL))
    d = ImageDraw.Draw(hills)
    for layer, color in enumerate([(112,123,143,100), (79,104,123,115), (54,84,100,120)]):
        points = [(0,320)]
        for xx in range(-10,331,3):
            yy = 200+layer*22 - 22*math.sin(xx/47+layer) - 10*math.sin(xx/21+layer*.6)
            points.append((xx, yy))
        points.append((330,320))
        d.polygon(points, fill=color)
    hills = hills.filter(ImageFilter.GaussianBlur(2.4))
    ha = np.array(hills)
    ha[:,:,3] = np.uint8(ha[:,:,3]*alpha)
    image.alpha_composite(Image.fromarray(ha))
    # Broad haze separates the far ridges and creates a quiet clearing.
    glow(image, (203,220), 66, (154,190,185), 25+22*n)
    clouds = Image.new('RGBA', image.size)
    cd = ImageDraw.Draw(clouds)
    for xx, yy, ww in [(57,85,65),(170,124,73),(254,163,57)]:
        cd.ellipse((xx-ww/2,yy-4,xx+ww/2,yy+6), fill=(202,215,216,round(30-15*n)))
    image.alpha_composite(clouds.filter(ImageFilter.GaussianBlur(5)))
    return image


def frame(index, garden, celestial=True):
    p = index/15
    n = .16*smooth(p)
    rng = random.Random(812)
    image = atmosphere(p)
    if celestial:
        # A warm low sun remains visible in the open sky; the scene never turns to night.
        sun_y = 78 + 35*smooth(p)
        glow(image, (251,sun_y), 36, (255,220,152), 95)
        sun = Image.new('RGBA', (CELL,CELL))
        ImageDraw.Draw(sun).ellipse((237,sun_y-14,265,sun_y+14),
                                   fill=(255,240,189,245))
        image.alpha_composite(sun)
    reveal = .18*smooth(p)
    # Source poses already grow grass, flowers, a trunk, then a branching canopy.
    source_index = min(15, index+1)
    col, row = source_index%4, source_index//4
    art = garden.crop((col*CELL,row*CELL,(col+1)*CELL,(row+1)*CELL))
    # A slightly larger left-side tree shelters the sleeper, leaving the sun clear.
    art = tint(art,n)
    # Preserve the canopy proportions; lengthen only the lower trunk segment.
    upper = art.crop((0,0,320,190)).resize((240,143),Image.Resampling.LANCZOS)
    lower = art.crop((0,190,320,320)).resize((240,118),Image.Resampling.LANCZOS)
    tall_tree = Image.new('RGBA',(240,261))
    tall_tree.alpha_composite(upper,(0,0))
    tall_tree.alpha_composite(lower,(0,143))
    image.alpha_composite(tall_tree,(-4,53))
    # Low continuous foreground uses the grass-only pose, with an organic alpha edge.
    base = tint(garden.crop((2*CELL,244,3*CELL,304)),n)
    base = base.resize((304,57),Image.Resampling.LANCZOS)
    # Fade the cropped fronds into the clearing instead of leaving a straight cut.
    base_rgba = np.array(base)
    blend_top = np.clip(np.arange(base.height)/15, 0, 1)[:, None]
    base_rgba[:, :, 3] = np.uint8(base_rgba[:, :, 3]*blend_top)
    image.alpha_composite(Image.fromarray(base_rgba),(8,246))
    # A low painted stone nestles into the moss; the engraved rune is restrained.
    growth = smooth((p-.28)/.54)
    if growth > .02:
        rock = garden.crop((247, 256, 298, 296))
        rock = tint(rock, n).resize((39, max(1,round(29*growth))), Image.Resampling.LANCZOS)
        image.alpha_composite(rock, (252, 290-rock.height))
        glyph = smooth((p-.48)/.38)*(.86+.14*math.sin(index*.9))
        markings = Image.new('RGBA', image.size)
        rd = ImageDraw.Draw(markings)
        ink = (172,234,216,round(190*glyph))
        rd.line([(270,267),(274,273),(269,279),(265,273),(270,267)],fill=ink,width=1)
        glow(image,(270,273),8,(118,216,192),32*glyph)
        image.alpha_composite(markings)
    # Fine moss flecks and firefly light build up gradually in fixed places.
    moss = smooth((p-.08)/.8)
    detail = Image.new('RGBA', image.size)
    for _ in range(110):
        xx, yy = rng.uniform(23,298), rng.uniform(279,298)
        if abs(xx-157)<58 and yy<290: continue
        if rng.random()>moss: continue
        r=rng.uniform(.6,1.7)
        dd=ImageDraw.Draw(detail)
        dd.ellipse((xx-r,yy-r/2,xx+r,yy+r/2),fill=(119,187,139,round(130+60*n)))
    for xx,yy in [(52,248),(216,263),(288,231),(72,198),(223,176)]:
        strength = reveal*(.8+.2*math.sin(index*.7+xx))
        glow(image,(xx,yy),5,(155,238,194),70*strength)
        ImageDraw.Draw(detail).ellipse((xx-1,yy-1,xx+1,yy+1),fill=(211,255,209,round(220*strength)))
    image.alpha_composite(detail)
    # Keep the broad sky opaque, but dissolve the outer margins into the app.
    # Apply to the complete frame so plants, moon glow and terrain share one edge.
    yy, xx = np.mgrid[:CELL, :CELL]
    distance = np.sqrt(((xx-160)/160)**2 + ((yy-172)/166)**2)
    feather = np.clip((1.02-distance)/.38, 0, 1)
    feather = feather*feather*(3-2*feather)
    border = np.clip(np.minimum.reduce([xx,CELL-1-xx,yy,CELL-1-yy])/9,0,1)
    feather *= border
    rgba = np.array(image)
    rgba[:, :, 3] = np.uint8(rgba[:, :, 3]*feather)
    image = Image.fromarray(rgba)
    return image


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'assets/pixelPet/animations/home_sleep_rune_wolf_v7.png')
    args=parser.parse_args()
    garden=Image.open(ROOT/'assets/pixelPet/animations/home_sleep_garden.png').convert('RGBA')
    frames=[frame(i,garden) for i in range(16)]
    atlas=Image.new('RGBA',(1280,1280))
    preview=Image.new('RGB',(1320,1400),'#f7f4ef')
    pd=ImageDraw.Draw(preview)
    for i,f in enumerate(frames):
        atlas.alpha_composite(f,((i%4)*CELL,(i//4)*CELL))
        x,y=10+(i%4)*330,30+(i//4)*345
        preview.paste(f,(x,y),f)
        label = 'AFTERNOON'
        pd.text((x+14,y+322),f'{i+1:02d}  {label}',fill='#656d71')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    atlas.save(args.output,optimize=True)
    previews=ROOT/'tasks/previews'
    previews.mkdir(parents=True,exist_ok=True)
    preview.save(previews/'rune-wolf-sleep-contact.png')
    night=Image.new('RGBA',(320,320),'#f7f4ef')
    night.alpha_composite(frames[-1])
    pet=Image.open(ROOT/'assets/pixelPet/animations/rest_rune_wolf.png').convert('RGBA')
    side=pet.width//4
    pet=pet.crop((3*side,3*side,4*side,4*side)).resize((120,120),Image.Resampling.LANCZOS)
    night.alpha_composite(pet,(100,185))
    night.resize((640,640),Image.Resampling.LANCZOS).save(previews/'rune-wolf-sleep-afternoon.png')
    # Preview the same adjacent-frame blend the app uses, with first/last holds.
    def on_paper(frame):
        paper = Image.new('RGBA', (CELL,CELL), '#f7f4ef')
        paper.alpha_composite(frame)
        return paper.convert('RGB')
    motion = []
    for i in range(15):
        for step in range(5):
            t = smooth(step/5)
            motion.append(on_paper(Image.blend(frames[i], frames[i+1], t)))
    motion.extend([on_paper(frames[-1])]*18)
    motion = [on_paper(frames[0])]*8 + motion
    motion[0].save(previews/'rune-wolf-afternoon.gif', save_all=True,
                   append_images=motion[1:], duration=70, loop=0, disposal=2)
    print(f'Saved {args.output}; 16 late-afternoon raster frames and motion preview')


if __name__=='__main__':
    main()
