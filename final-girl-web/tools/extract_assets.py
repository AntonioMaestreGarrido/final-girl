"""
Extrae los assets del juego desde el material PnP original y los guarda
optimizados (WebP) en public/assets. No modifica el material original.

Uso:  python tools/extract_assets.py
Requiere: pymupdf, Pillow
"""
from __future__ import annotations

import sys
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "Final Girl - Completo (es)-maq"
OUT = ROOT / "public" / "assets"

CORE = SRC / "FINAL GIRL (Core) Corregido v.1.2 [ES][MAQ]"
HT = SRC / "FINAL GIRL (THE HAPPY TRAILS HORROR) [ES][MAQ]"

CARD_LONG_SIDE = 1000   # px del lado largo de cada carta
WEBP_QUALITY = 82

# Rotaciones (grados, sentido horario) para dejar la carta legible.
CW = 90
CCW = -90


# ---------------------------------------------------------------- utilidades

def trim_white(im: Image.Image, threshold: int = 235) -> Image.Image:
    """Recorta márgenes casi blancos alrededor de la imagen."""
    rgb = im.convert("RGB")
    bg = Image.new("RGB", rgb.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, bg).convert("L")
    mask = diff.point(lambda v: 255 if v > 255 - threshold else 0)
    bbox = mask.getbbox()
    return im.crop(bbox) if bbox else im


def trim_light_margins(im: Image.Image, light: int = 200, ratio: float = 0.8) -> Image.Image:
    """Recorta márgenes de escaneo (papel claro, no necesariamente blanco puro):
    elimina filas/columnas exteriores donde la mayoría de píxeles son claros."""
    gray = im.convert("L")
    w, h = gray.size
    px = gray.load()

    def is_light_row(y: int) -> bool:
        return sum(1 for x in range(0, w, 4) if px[x, y] > light) / len(range(0, w, 4)) > ratio

    def is_light_col(x: int) -> bool:
        return sum(1 for y in range(0, h, 4) if px[x, y] > light) / len(range(0, h, 4)) > ratio

    top = next(y for y in range(h) if not is_light_row(y))
    bottom = next(y for y in range(h - 1, -1, -1) if not is_light_row(y)) + 1
    left = next(x for x in range(w) if not is_light_col(x))
    right = next(x for x in range(w - 1, -1, -1) if not is_light_col(x)) + 1
    return im.crop((left, top, right, bottom))


def fit_long_side(im: Image.Image, long_side: int) -> Image.Image:
    w, h = im.size
    scale = long_side / max(w, h)
    if scale >= 1:
        return im
    return im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def save_webp(im: Image.Image, dest: Path, quality: int = WEBP_QUALITY) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=quality, method=6)
    print(f"  {dest.relative_to(OUT)}  {im.size[0]}x{im.size[1]}  {dest.stat().st_size // 1024} KB")


def rotate(im: Image.Image, degrees_cw: int) -> Image.Image:
    return im.rotate(-degrees_cw, expand=True) if degrees_cw else im


def pdf_image(doc: pymupdf.Document, xref: int) -> Image.Image:
    import io
    return Image.open(io.BytesIO(doc.extract_image(xref)["image"]))


def extract_cards(pdf: Path, dest_dir: Path, cards: dict[str, tuple[int, int]]) -> None:
    """cards: nombre -> (xref, rotación horaria)."""
    print(f"{pdf.name} -> {dest_dir.relative_to(OUT)}")
    doc = pymupdf.open(pdf)
    for name, (xref, rot) in cards.items():
        im = trim_white(pdf_image(doc, xref).convert("RGB"))
        im = fit_long_side(rotate(im, rot), CARD_LONG_SIDE)
        save_webp(im, dest_dir / f"{name}.webp")


def circle_crop(im: Image.Image, cx: int, cy: int, r: int) -> Image.Image:
    box = (cx - r, cy - r, cx + r, cy + r)
    tile = im.crop(box).convert("RGBA")
    mask = Image.new("L", tile.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
    tile.putalpha(mask)
    return tile


def extract_tokens(img_path: Path, dest_dir: Path, tokens: dict[str, tuple[int, int, int]], size: int = 256) -> None:
    print(f"{img_path.name} -> {dest_dir.relative_to(OUT)}")
    im = Image.open(img_path).convert("RGB")
    for name, (cx, cy, r) in tokens.items():
        save_webp(circle_crop(im, cx, cy, r).resize((size, size), Image.LANCZOS), dest_dir / f"{name}.webp", 90)


def extract_image(src: Path, dest: Path, long_side: int, crop_white: bool = True) -> None:
    im = Image.open(src).convert("RGB")
    if crop_white:
        im = trim_light_margins(im)
    save_webp(fit_long_side(im, long_side), dest)


def render_pdf_page(pdf: Path, dest: Path, long_side: int) -> None:
    doc = pymupdf.open(pdf)
    pix = doc[0].get_pixmap(dpi=300)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    save_webp(fit_long_side(im, long_side), dest)


# ---------------------------------------------------------------- Caja básica

def core() -> None:
    out = OUT / "core"

    extract_cards(CORE / "Cartas" / "Cartas Accion core corregido.pdf", out / "actions", {
        "concentrarse": (13, 0),
        "guardia": (15, 0),
        "contraataque": (16, 0),
        "caminar": (17, 0),
        "descanso-corto": (18, 0),
        "ataque-debil": (19, 0),
        "back": (14, 0),
        "improvisar": (25, 0),
        "planear": (26, 0),
        "descanso-largo": (27, 0),
        "golpe-furioso": (28, 0),
        "golpe-critico": (29, 0),
        "buscar": (30, 0),
        "correr": (31, 0),
        "distraccion": (36, 0),
        "por-los-pelos": (37, 0),
    })

    print("Tableros del jugador")
    render_pdf_page(CORE / "Tablero" / "Board - Player - Final Girl [Core].pdf", out / "player-board-normal.webp", 1800)
    render_pdf_page(CORE / "Tablero" / "Board - Player - Extreme Horror [Core].pdf", out / "player-board-extreme.webp", 1800)

    # Fichas de Vida Final (coordenadas en píxeles de las hojas originales)
    extract_tokens(CORE / "Tokens" / "Tokens front.jpg", out / "tokens", {
        "final-life-black": (1073, 1257, 112),
        "final-life-white": (1686, 1567, 112),
    })
    extract_tokens(CORE / "Tokens" / "Tokens back.jpg", out / "tokens", {
        "final-life-reveal-0": (1321, 1568, 110),
        "final-life-reveal-1": (1626, 1568, 110),
        "final-life-reveal-2": (1931, 1568, 110),
        "final-life-reveal-3": (2238, 1568, 110),
    })

    print("Dados")
    dice = Image.open(CORE / "Dados" / "Dice [Core].png").convert("RGB")
    w, h = dice.size
    face_w = w / 6
    for i in range(6):
        face = dice.crop((round(i * face_w), 0, round((i + 1) * face_w), h))
        side = min(face.size)
        face = face.crop(((face.width - side) // 2, (face.height - side) // 2,
                          (face.width + side) // 2, (face.height + side) // 2))
        save_webp(face.resize((200, 200), Image.LANCZOS), out / "dice" / f"face-{i + 1}.webp", 90)

    print("Portada")
    extract_image(CORE / "Portada.jpg", out / "cover.webp", 1400)


# ------------------------------------------------- Happy Trails Horror: Hans

def hans() -> None:
    out = OUT / "killers" / "hans"

    extract_cards(HT / "Terror cards" / "Terror Hans the butcher.pdf", out / "horror", {
        "balanceando-su-martillo": (13, 0),
        "el-ya-esta-ahi": (15, 0),
        "sigue-viniendo": (16, 0),
        "ha-salido-de-ninguna-parte": (17, 0),
        "quiere-sangre-fresca": (19, 0),
        "terrorifica-fiebre-del-martillo": (28, 0),
        "hans-me-quiere-a-mi": (29, 0),
        "rabia-malvada": (30, 0),
        "tomando-recuerdos": (31, 0),
        "banquete-oscuro": (33, 0),
        "velocidad-endemoniada": (34, 0),
    })
    extract_cards(HT / "Finale cards" / "Finale.pdf", out / "finale", {
        "oscuro-lugubre-tenebroso": (13, CW),
        "sed-de-sangre": (15, CW),
        "bano-de-sangre": (16, CW),
        "back": (14, CCW),
    })
    extract_cards(HT / "Dark Power cards" / "Dark Power.pdf", out / "dark-power", {
        "la-masacre-del-martillo": (13, CW),
        "oscura-obsesion": (15, CW),
        "alimentar": (16, CW),
        "frenesi-de-sangre": (17, CW),
        "back": (14, CCW),
    })

    print("Tablero y portada de Hans")
    extract_image(HT / "Tableros" / "HANS THE BUTCHER.jpg", out / "board.webp", 2000)
    extract_image(HT / "Carátulas (traseras de tableros)" / "Hans the Butcher.jpg", out / "cover.webp", 1400)


# ----------------------------------------- Happy Trails Horror: Camp Happy Trails

def camp() -> None:
    out = OUT / "locations" / "camp-happy-trails"

    extract_cards(HT / "Terror cards" / "Terror Camp Happy Trails.pdf", out / "horror", {
        "veamos-si-son-ciertos-los-rumores": (13, 0),
        "puede-que-las-cosas-empiecen": (15, 0),
        "corre-por-tu-vida": (16, 0),
        "esa-chica-como-se-llama": (17, 0),
        "que-ruido-es-ese": (18, 0),
        "fuego": (19, 0),
        "me-quede-dormido": (20, 0),
        "no-puedes-salvarnos": (21, 0),
    })
    extract_cards(HT / "Eventos cards" / "Eventos.pdf", out / "events", {
        "desafortunados-amantes": (13, CW),
        "novio": (17, CW),
        "carne-fresca": (18, CW),
        "crios-cabezotas": (19, CW),
        "campistas-pegajosos": (20, CW),
        "novia": (21, CW),
        "aguas-oscuras": (22, CW),
        "tunel-secreto": (23, CW),
        "deseo-mortal": (24, CW),
        "venganza": (25, CW),
        "back": (16, CW),
    })
    extract_cards(HT / "Setup cards" / "setup.pdf", out / "setup", {
        "caza-del-tesoro": (10, 0),
        "captura-la-bandera": (6, 0),
        "hora-de-la-meditacion": (7, 0),
        "el-bano-de-la-piel": (8, 0),
        "la-hoguera": (9, 0),
        "back": (16, 0),
    })
    extract_cards(HT / "Objetos cards" / "Objetos.pdf", out / "items", {
        "bate-metalico": (13, 0),
        "silbato": (15, 0),
        "bebida-energetica": (16, 0),
        "tapadera": (17, 0),
        "cuchillo": (18, 0),
        "llaves-del-bote-a-motor": (19, 0),
        "arco": (20, 0),
        "fuegos-artificiales": (21, 0),
        "dados-de-la-suerte": (22, 0),
        "pildoras-misteriosas": (23, 0),
        "hacha": (24, 0),
        "kit-de-primeros-auxilios": (25, 0),
        "pata-de-conejo": (26, 0),
        "viejo-revolver": (27, 0),
        "trampa-para-osos": (28, 0),
        "linterna": (29, 0),
        "mapa": (35, 0),
        "spray-pimienta": (36, 0),
        "back": (14, 0),
    })

    # Fichas (hoja "a" = anverso). Coordenadas en píxeles originales (841x548).
    extract_tokens(HT / "Tokens" / "Token [Happy Trails Horror - Camp Happy Trails] a.png", out / "tokens", {
        "bote-a-motor": (139, 126, 104),
        "trampa-para-osos": (420, 126, 104),
        "fuegos-artificiales": (709, 126, 104),
        "tunel-secreto-1": (139, 411, 104),
        "tunel-secreto-2": (420, 411, 104),
        "aguas-oscuras": (709, 411, 104),
    })

    print("Tablero y portada del campamento")
    extract_image(HT / "Tableros" / "CAMP HAPPY TRAILS.jpg", out / "board.webp", 2400)
    extract_image(HT / "Carátulas (traseras de tableros)" / "Camp Happy Trails.jpg", out / "cover.webp", 1400)


# ------------------------------------------------------ Chicas Finales (HT)

def final_girls() -> None:
    out = OUT / "final-girls"
    extract_cards(HT / "Final Girl cards" / "Final Girls.pdf", out, {
        "laurie-ultimate": (6, CW),
        "reiko-ultimate": (7, CW),
        "reiko": (13, CCW),
        "laurie": (14, CCW),
    })
    extract_cards(HT / "Objetos cards" / "Bonus" / "Objetos bonus.pdf", out / "bonus-items", {
        "arco-de-laurie": (13, 0),
        "hacha-de-reiko": (17, 0),
    })


def portrait_token(src: Path, dest: Path, cx: int, cy: int, r: int, ring: tuple[int, int, int], size: int = 256) -> None:
    """Token redondo con la cara del personaje y un aro de color."""
    face = circle_crop(Image.open(src).convert("RGB"), cx, cy, r).resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(face, (0, 0), face)
    draw = ImageDraw.Draw(out)
    w = size // 14
    draw.ellipse((0, 0, size - 1, size - 1), outline=ring, width=w)
    draw.ellipse((0, 0, size - 1, size - 1), outline=(0, 0, 0), width=3)
    draw.ellipse((w - 2, w - 2, size - w + 1, size - w + 1), outline=(0, 0, 0), width=2)
    save_webp(out, dest, 90)


def portraits() -> None:
    """Tokens de figura a partir del arte oficial ya extraído."""
    print("Tokens de personaje")
    fg = OUT / "final-girls"
    portrait_token(fg / "laurie.webp", fg / "laurie-token.webp", 835, 330, 210, (245, 245, 245))
    portrait_token(fg / "reiko.webp", fg / "reiko-token.webp", 800, 300, 215, (245, 245, 245))
    hans = OUT / "killers" / "hans"
    portrait_token(hans / "board.webp", hans / "token.webp", 920, 640, 150, (200, 20, 28))

    # Imágenes del menú de selección (las portadas de caja muestran a la Chica Final).
    print("Imágenes de selección")
    save_webp(Image.open(hans / "board.webp").convert("RGB").crop((560, 330, 1300, 1560)), hans / "select.webp")
    camp = OUT / "locations" / "camp-happy-trails"
    save_webp(fit_long_side(Image.open(camp / "board.webp").convert("RGB").crop((0, 110, 2400, 2168)), 1200), camp / "select.webp")


# ------------------------------------------- Slaughter in the Groves (SG)

SG = SRC / "FINAL GIRL (SLAUGHTER IN THE GROOVES) [ES][MAQ]"


def inkanyamba() -> None:
    out = OUT / "killers" / "inkanyamba"
    extract_cards(SG / "Terror" / "Inkanyamba.pdf", out / "horror", {
        "viene-no-hay-nada": (13, 0),
        "caracter-voluble": (18, 0),
        "ira-de-la-sangre": (20, 0),
        "ira-de-la-oportunidad": (21, 0),
        "ira-de-la-muerte": (22, 0),
        "ira-de-los-profanadores": (28, 0),
        "ira-del-horror": (29, 0),
        "castigo-o-clemencia": (30, 0),
        "le-faltaron-al-respeto": (31, 0),
        "no-se-como": (32, 0),
        "ira-hirviendo": (33, 0),
        "adicto-a-la-indignacion": (34, 0),
    })
    extract_cards(SG / "Finale" / "Finale.pdf", out / "finale", {
        "ciclon-salvaje": (13, CW),
        "rabieta-violenta": (15, CW),
        "necesitamos-un-milagro": (16, CW),
        "back": (14, CW),
    })
    extract_cards(SG / "Dark Power" / "Dark Power.pdf", out / "dark-power", {
        "fiesta-de-la-ira": (13, CW),
        "miedo-creciente": (15, CW),
        "temperamento-volatil": (16, CW),
        "oscuro-relampago": (17, CW),
        "back": (14, CW),
    })
    extract_cards(SG / "Cartas  Especiales" / "Cartas Ira.pdf", out / "wrath", {
        "ira-asesina": (14, 0),
        "back": (13, 0),
    })
    print("Tablero y portada de Inkanyamba")
    extract_image(SG / "Boards" / "Inkanyamba.jpg", out / "board.webp", 2000, crop_white=False)
    extract_image(SG / "Box Covers" / "Inkanyamba.jpg", out / "cover.webp", 1400)


def sacred_groves() -> None:
    out = OUT / "locations" / "sacred-groves"
    extract_cards(SG / "Terror" / "Sacred Grooves.pdf", out / "horror", {
        "la-ira-de-los-dioses": (13, 0),
        "la-furia-de-los-dioses": (15, 0),
        "dejame-grabar-mis-iniciales": (16, 0),
        "nadie-se-dara-cuenta": (17, 0),
        "trampa-de-turistas": (18, 0),
        "si-me-subo-a-esa-estatua": (19, 0),
        "castigo-divino": (20, 0),
        "la-volubilidad-de-los-dioses": (21, 0),
    })
    extract_cards(SG / "Eventos" / "Eventos.pdf", out / "events", {
        "cerrado-por-mantenimiento": (13, CCW),
        "fuego-y-azufre": (15, CCW),
        "suelo-sagrado": (16, CCW),
        "el-super-turista": (17, CCW),
        "el-hombre-sagrado": (18, CCW),
        "el-guia-turistico": (19, CCW),
        "ruidosos-y-odiosos": (20, CCW),
        "los-dioses-odian-los-fallos": (21, CCW),
        "matanza-impia": (22, CCW),
        "fotografia-con-flash": (23, CCW),
        "back": (14, CCW),
    })
    extract_cards(SG / "Setup" / "Setup.pdf", out / "setup", {
        "dia-de-la-familia": (13, 0),
        "la-cosa-del-pantano": (15, 0),
        "guia-turistico-del-duelo": (16, 0),
        "montones-de-turistas": (17, 0),
        "servicio-de-culto": (18, 0),
        "back": (14, 0),
    })
    extract_cards(SG / "Objetos" / "Objetos.pdf", out / "items", {
        "tapadera": (13, 0),
        "daga-ceremonial": (15, 0),
        "pildoras-misteriosas": (16, 0),
        "huesos-del-shaman": (17, 0),
        "mascara-tribal": (18, 0),
        "bebida-energetica": (19, 0),
        "viejo-rifle": (20, 0),
        "palo-de-guerra": (21, 0),
        "kit-de-primeros-auxilios": (22, 0),
        "senales-fuera-de-servicio": (23, 0),
        "bocina": (24, 0),
        "incienso": (25, 0),
        "spray-pimienta": (26, 0),
        "bate-metalico": (27, 0),
        "mapa": (28, 0),
        "libro-de-oracion": (29, 0),
        "latigo": (35, 0),
        "back": (14, 0),
    })
    extract_cards(SG / "Cartas  Especiales" / "Cartas Ira.pdf", out / "wrath", {
        "ira-divina": (16, 0),
        "back": (15, 0),
    })
    extract_tokens(SG / "Tokens" / "Token [Slaughter in The Groves - Sacred Groves] a.png", out / "tokens", {
        "cerrado": (127, 163, 100),
        "fuego-y-azufre": (124, 425, 100),
        "fuera-de-servicio": (406, 425, 100),
        "suelo-sagrado": (124, 709, 100),
    })
    print("Track de Sed de Sangre, ficha de Final, tablero y portada de Sacred Groves")
    extract_image(SG / "Tokens" / "Track Sed de sangre front.jpg", out / "bloodlust-track.webp", 800, crop_white=False)
    extract_image(SG / "Tokens" / "Finale Token front.jpg", out / "finale-token.webp", 600, crop_white=False)
    extract_image(SG / "Boards" / "Sacred Grooves.jpg", out / "board.webp", 2400, crop_white=False)
    extract_image(SG / "Box Covers" / "Sacred Grooves.jpg", out / "cover.webp", 1400)


def grooves_final_girls() -> None:
    out = OUT / "final-girls"
    extract_cards(SG / "Final Girls" / "Final Girls.pdf", out, {
        "adelaide-ultimate": (13, CW),
        "adelaide": (14, CW),
        "barbara-ultimate": (15, CW),
        "barbara": (16, CW),
    })
    extract_cards(SG / "Objetos" / "Bonus" / "Bonus.pdf", out / "bonus-items", {
        "bate-y-escudo-de-adelaide": (14, 0),
        "rifle-de-barbara": (18, 0),
    })
    extract_cards(SG / "Cartas  Especiales" / "Carta Accion Expiar.pdf", OUT / "core" / "actions", {
        "expiar": (13, 0),
    })


def grooves_portraits() -> None:
    print("Tokens y selección de Slaughter in the Groves")
    fg = OUT / "final-girls"
    portrait_token(fg / "adelaide.webp", fg / "adelaide-token.webp", 820, 300, 210, (245, 245, 245))
    portrait_token(fg / "barbara.webp", fg / "barbara-token.webp", 790, 300, 210, (245, 245, 245))
    ink = OUT / "killers" / "inkanyamba"
    portrait_token(ink / "board.webp", ink / "token.webp", 860, 790, 120, (200, 20, 28))
    save_webp(Image.open(ink / "board.webp").convert("RGB").crop((480, 480, 1260, 1620)), ink / "select.webp")
    sg = OUT / "locations" / "sacred-groves"
    board = Image.open(sg / "board.webp").convert("RGB")
    save_webp(fit_long_side(board.crop((0, round(board.height * 0.19), board.width, board.height)), 1200), sg / "select.webp")


# ------------------------------------------------ Carnage at the Carnival (CN)

CN = SRC / "FINAL GIRL (CARNAGE AT THE CARNIVAL) [ES][MAQ]"


def geppetto() -> None:
    out = OUT / "killers" / "geppetto"
    extract_cards(CN / "Terror" / "Geppetto.pdf", out / "horror", {
        "loca-risa-interminable": (13, 0),
        "piezas-de-repuesto": (15, 0),
        "seras-un-divertido-nuevo-juguete": (16, 0),
        "encerrado-y-sin-lugar-donde-ir": (17, 0),
        "hacer-o-romper": (18, 0),
        "no-hay-salida": (19, 0),
        "traedmela": (20, 0),
        "showman-maestro": (21, 0),
        "nos-tienen-completamente-rodeados": (22, 0),
        "baila-muneco": (28, 0),
        "vienen-por-todas-partes": (29, 0),
        "cielo-santo-esos-son-nuestros-amigos": (30, 0),
        "cuerdas-cuchilla-de-marioneta": (31, 0),
        "me-estan-ganando": (32, 0),
        "soy-una-marioneta": (33, 0),
        "marionetas-por-doquier": (34, 0),
    })
    extract_cards(CN / "Finale" / "Finale.pdf", out / "finale", {
        "hice-a-tus-amigos": (13, CW),
        "sin-ataduras": (15, CW),
        "les-recuerdas": (16, CW),
        "back": (14, CW),
    })
    extract_cards(CN / "Dark Power" / "Dark Power.pdf", out / "dark-power", {
        "abominacion-masiva": (13, CW),
        "injerto-de-armas": (15, CW),
        "maestro-inmortal": (16, CW),
        "unete-a-la-familia": (17, CW),
        "back": (14, CW),
    })
    extract_cards(CN / "Cartas Especiales" / "Special Cards.pdf", out / "special", {
        "marionetas": (15, 0),
    })
    extract_tokens(CN / "Tokens" / "Imagenes" / "Tokens_B_Front.jpg", out / "minions", {
        "marioneta-1": (142, 125, 104),
        "marioneta-2": (421, 122, 104),
        "marioneta-3": (712, 125, 104),
    })
    print("Tablero y portada de Geppetto")
    extract_image(CN / "Boards" / "SIde A Geppetto.jpg", out / "board.webp", 2000, crop_white=False)
    extract_image(CN / "Box Covers" / "Side A Geppetto.jpg", out / "cover.webp", 1400)


def carnival_of_blood() -> None:
    out = OUT / "locations" / "carnival-of-blood"
    extract_cards(CN / "Terror" / "Carnival of Blood.pdf", out / "horror", {
        "estoy-atrapada": (13, 0),
        "quema-quema": (15, 0),
        "de-donde-salen-las-cuchillas": (16, 0),
        "brumosa-emboscada": (17, 0),
        "como-puede-haber-tantas-trampas": (18, 0),
        "esto-es-un-apoyo": (19, 0),
        "bienvenidos-al-mayor-show": (20, 0),
        "como-se-ha-escapado-el-leon": (21, 0),
    })
    extract_cards(CN / "Eventos" / "Eventos.pdf", out / "events", {
        "transporte-de-empleados": (13, CCW),
        "no-es-real": (15, CCW),
        "me-seguiste-hasta-aqui": (16, CCW),
        "corre-yo-les-entretendre": (17, CCW),
        "luna-llena": (18, CCW),
        "espejos-por-todas-partes": (19, CCW),
        "demasiada-basura": (20, CCW),
        "como-puede-ser-de-peligroso": (21, CCW),
        "payasos-por-doquier": (22, CCW),
        "panico-animal": (23, CCW),
        "back": (14, CCW),
    })
    extract_cards(CN / "Setup" / "Setup.pdf", out / "setup", {
        "encerrados-en-caja": (13, 0),
        "no-tiene-gracia": (15, 0),
        "escenario-central": (16, 0),
        "corro-alrededor-de-rosie": (17, 0),
        "tarde-para-el-show": (18, 0),
        "back": (14, 0),
    })
    extract_cards(CN / "Objetos" / "Objetos.pdf", out / "items", {
        "martillo-de-forzudo": (13, 0),
        "zappo": (15, 0),
        "bebida-energetica": (16, 0),
        "cuchillo": (17, 0),
        "super-dados-de-la-suerte": (18, 0),
        "bate-de-aluminio": (19, 0),
        "kit-de-primeros-auxilios": (20, 0),
        "pertiga": (21, 0),
        "latigo": (22, 0),
        "cinta-encontrada": (23, 0),
        "pildoras-misteriosas": (24, 0),
        "hacha-arrojadiza": (25, 0),
        "bola-de-cristal": (26, 0),
        "viejo-revolver": (27, 0),
        "tapadera": (28, 0),
        "kit-de-maquillaje": (29, 0),
        "bandolera-de-cuchillos": (35, 0),
        "spray-de-pimienta": (36, 0),
        "back": (14, 0),
    })
    extract_cards(CN / "Objetos" / "Objetos Trampa.pdf", out / "items", {
        "trampa-para-osos-de-acero": (13, 0),
        "trampa-de-gas-somnifero": (15, 0),
        "trampa-de-la-cobra-oculta": (16, 0),
    })
    extract_cards(CN / "Cartas Especiales" / "Special Cards.pdf", out / "special", {
        "referencia-trampa": (13, 0),
    })
    extract_tokens(CN / "Tokens" / "Imagenes" / "Tokens_A_Front.jpg", out / "tokens", {
        "trampa-acido": (140, 125, 104),
        "trampa-red": (425, 122, 104),
        "trampa-sierras": (708, 125, 104),
        "carro-de-golf": (140, 408, 104),
        "calavera": (425, 408, 104),
    })
    print("Tablero y portada de Carnival of Blood")
    extract_image(CN / "Boards" / "Side B Carnival of blood.jpg", out / "board.webp", 2400, crop_white=False)
    extract_image(CN / "Box Covers" / "SIde B Carnival Of Blood.jpg", out / "cover.webp", 1400)


def carnival_final_girls() -> None:
    out = OUT / "final-girls"
    extract_cards(CN / "Final Girls" / "Final Girls.pdf", out, {
        "asami-ultimate": (13, CW),
        "asami": (14, CW),
        "charlie-ultimate": (15, CW),
        "charlie": (16, CW),
    })
    extract_cards(CN / "Objetos" / "Bonus" / "Bonus.pdf", out / "bonus-items", {
        "cinturon-de-cuchillos-de-asami": (16, 0),
        "martillo-gigante-de-charlie": (20, 0),
    })


def carnival_portraits() -> None:
    print("Tokens y selección de Carnage at the Carnival")
    fg = OUT / "final-girls"
    portrait_token(fg / "asami.webp", fg / "asami-token.webp", 830, 320, 200, (245, 245, 245))
    portrait_token(fg / "charlie.webp", fg / "charlie-token.webp", 820, 320, 200, (245, 245, 245))
    gep = OUT / "killers" / "geppetto"
    board = Image.open(gep / "board.webp").convert("RGB")
    w, h = board.size
    portrait_token(gep / "board.webp", gep / "token.webp", round(w * 0.388), round(h * 0.368), round(w * 0.06), (200, 20, 28))
    save_webp(board.crop((round(w * 0.20), round(h * 0.25), round(w * 0.64), round(h * 0.93))), gep / "select.webp")
    cb = OUT / "locations" / "carnival-of-blood"
    board = Image.open(cb / "board.webp").convert("RGB")
    save_webp(fit_long_side(board.crop((0, round(board.height * 0.19), board.width, board.height)), 1200), cb / "select.webp")


def main() -> None:
    if not SRC.exists():
        sys.exit(f"No encuentro el material original en {SRC}")
    only = set(sys.argv[1:])
    if not only or "core" in only:
        core()
        hans()
        camp()
        final_girls()
        portraits()
    if not only or "grooves" in only:
        inkanyamba()
        sacred_groves()
        grooves_final_girls()
        grooves_portraits()
    if not only or "carnival" in only:
        geppetto()
        carnival_of_blood()
        carnival_final_girls()
        carnival_portraits()
    total = sum(f.stat().st_size for f in OUT.rglob("*.webp"))
    print(f"\nTotal: {len(list(OUT.rglob('*.webp')))} archivos, {total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
