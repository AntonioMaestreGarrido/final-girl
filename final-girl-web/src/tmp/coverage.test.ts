import { it } from 'vitest';
import { createGame, dispatch } from '../engine';
import { botRng, randomInput } from '../engine/testing';

const KEYS = ['Consigues', 'salva ', 'juega Buscar', 'juega Expiar', 'Expiar: éxito', 'Habilidad Definitiva desbloqueada', 'descartas al azar', 'Guía Turístico', 'Se Desata la Ira Asesina', 'Se Desata la Ira Divina', 'Ira Divina aumenta', 'Ira Asesina aumenta', 'baja a', 'Track de Sed de Sangre', 'Ficha de Final', 'Hombre Sagrado', 'Super Turista', 'Guía Turístico está contigo', 'cierras', 'Fuera de servicio', 'Bocina', 'Oscuro relámpago', 'Expiar: éxito triple', 'Libro de oración', 'Carácter voluble:', 'Ira hirviendo:', 'La volubilidad de los dioses:', 'Temperamento volátil:', 'Barbara hace', 'Habilidad Definitiva de Adelaide', 'Coges la carta', 'Fotografía con flash', 'Matanza impía', 'Suelo sagrado: terminas', 'dioses odian', 'Látigo arrastra', 'Palo de guerra', 'Daga ceremonial', 'Máscara tribal', 'Huesos del shamán', 'Bate y escudo', 'Fiesta de la ira', 'Miedo creciente', 'Incienso', 'Adicto', 'Ruidosos', 'La Ira Asesina sube a 10', 'no puede pasar', 'Rifle de Barbara', 'Descartas al azar', 'aparece en'];
it('cobertura', () => {
  const hits: Record<string, number> = Object.fromEntries(KEYS.map((k) => [k, 0]));
  for (let seed = 1; seed <= 600; seed++) {
    let s = createGame({ killerId: 'inkanyamba', locationId: 'sacred-groves', finalGirlId: seed % 2 ? 'adelaide' : 'barbara', board: 'normal', epicDarkPower: seed % 4 === 0, bonusItems: true, seed });
    const r = botRng(seed);
    let n = 0;
    while (!s.outcome && n++ < 4000) s = dispatch(s, randomInput(s, r));
    const text = s.log.map