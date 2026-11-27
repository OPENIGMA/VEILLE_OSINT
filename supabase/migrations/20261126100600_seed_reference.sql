-- ============================================================================
-- 7/7 — Données de référence : thèmes, zones de défense, régions, départements
-- Les communes et EPCI se chargent séparément (supabase/seed/).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Thèmes (45) — « sort » du cahier des charges = sport.
-- tone : couleur du tag (magenta = menace, ambre = tension, lime = vie locale,
-- cyan = économie / infrastructures). Modifiable par simple UPDATE.
-- ----------------------------------------------------------------------------
insert into public.themes (slug, label, group_name, tone, sort_order) values
  ('agriculture',                   'Agriculture',                    'Économie & infrastructures', 'cyan',    10),
  ('economie',                      'Économie',                       'Économie & infrastructures', 'cyan',    20),
  ('energie',                       'Énergie',                        'Économie & infrastructures', 'cyan',    30),
  ('nucleaire',                     'Nucléaire',                      'Économie & infrastructures', 'cyan',    40),
  ('ferroviaire',                   'Ferroviaire',                    'Économie & infrastructures', 'cyan',    50),
  ('transports',                    'Transports',                     'Économie & infrastructures', 'cyan',    60),
  ('armees',                        'Armées',                         'Défense & sécurité',         'cyan',    70),
  ('armes',                         'Armes',                          'Défense & sécurité',         'magenta', 80),
  ('criminalite-organisee',         'Criminalité organisée',          'Défense & sécurité',         'magenta', 90),
  ('culture',                       'Culture',                        'Société & vie locale',       'lime',   100),
  ('sport',                         'Sport',                          'Société & vie locale',       'lime',   110),
  ('sante',                         'Santé',                          'Société & vie locale',       'lime',   120),
  ('education',                     'Éducation',                      'Société & vie locale',       'lime',   130),
  ('ecologie',                      'Écologie',                       'Société & vie locale',       'lime',   140),
  ('chasse',                        'Chasse',                         'Société & vie locale',       'lime',   150),
  ('peche',                         'Pêche',                          'Société & vie locale',       'lime',   160),
  ('visite-officielle',             'Visite officielle',              'Société & vie locale',       'lime',   170),
  ('elections-2027',                'Élections 2027',                 'Société & vie locale',       'lime',   180),
  ('joph2030',                      'JOP d''hiver 2030',              'Société & vie locale',       'lime',   190),
  ('delinquance',                   'Délinquance',                    'Ordre public & tensions',    'amber',  200),
  ('violences-urbaines',            'Violences urbaines',             'Ordre public & tensions',    'amber',  210),
  ('emeute',                        'Émeute',                         'Ordre public & tensions',    'amber',  220),
  ('greve',                         'Grève',                          'Ordre public & tensions',    'amber',  230),
  ('blocage',                       'Blocage',                        'Ordre public & tensions',    'amber',  240),
  ('occupation',                    'Occupation',                     'Ordre public & tensions',    'amber',  250),
  ('gilets-jaunes',                 'Gilets jaunes',                  'Ordre public & tensions',    'amber',  260),
  ('projet-amenagement-conteste',   'Projet d''aménagement contesté', 'Ordre public & tensions',    'amber',  270),
  ('free-party',                    'Free party',                     'Ordre public & tensions',    'amber',  280),
  ('teknival',                      'Teknival',                       'Ordre public & tensions',    'amber',  290),
  ('installation-illicite',         'Installation illicite',          'Ordre public & tensions',    'amber',  300),
  ('squat',                         'Squat',                          'Ordre public & tensions',    'amber',  310),
  ('survivalisme',                  'Survivalisme',                   'Ordre public & tensions',    'amber',  320),
  ('animalistes',                   'Animalistes',                    'Ordre public & tensions',    'amber',  330),
  ('culte',                         'Culte',                          'Ordre public & tensions',    'amber',  340),
  ('proselytisme',                  'Prosélytisme',                   'Ordre public & tensions',    'amber',  350),
  ('derives-sectaires',             'Dérives sectaires',              'Extrémismes & radicalisation', 'magenta', 360),
  ('separatisme',                   'Séparatisme',                    'Extrémismes & radicalisation', 'magenta', 370),
  ('radicalisation',                'Radicalisation',                 'Extrémismes & radicalisation', 'magenta', 380),
  ('apologie',                      'Apologie',                       'Extrémismes & radicalisation', 'magenta', 390),
  ('attentat',                      'Attentat',                       'Extrémismes & radicalisation', 'magenta', 400),
  ('ultra-gauche',                  'Ultra gauche',                   'Extrémismes & radicalisation', 'magenta', 410),
  ('ultra-droite',                  'Ultra droite',                   'Extrémismes & radicalisation', 'magenta', 420),
  ('cybercriminalite',              'Cybercriminalité',               'Menaces numériques & ingérences', 'magenta', 430),
  ('drones',                        'Drones',                         'Menaces numériques & ingérences', 'magenta', 440),
  ('ingerences-etrangeres',         'Ingérences étrangères',          'Menaces numériques & ingérences', 'magenta', 450);

-- ----------------------------------------------------------------------------
-- Zones de défense et de sécurité (ZDS).
-- Vérifié par deux sources indépendantes (Assemblée nationale, ministère des
-- Armées) : l'Occitanie est rattachée à la zone Sud depuis le 1er janvier 2016 ;
-- la zone Sud-Ouest correspond à la seule Nouvelle-Aquitaine.
-- Les autres rattachements ci-dessous sont cohérents avec les sources
-- consultées mais restent À CONFIRMER (Code de la défense, art. R.1211-4) :
-- Normandie, Centre-Val de Loire et Bourgogne-Franche-Comté sont volontairement
-- laissées sans zone, comme l'outre-mer. Corriger = un simple UPDATE de parent_id.
-- ----------------------------------------------------------------------------
insert into public.territories (type, code, name) values
  ('zds', 'paris',     'ZDS Paris'),
  ('zds', 'nord',      'ZDS Nord'),
  ('zds', 'est',       'ZDS Est'),
  ('zds', 'ouest',     'ZDS Ouest'),
  ('zds', 'sud-ouest', 'ZDS Sud-Ouest'),
  ('zds', 'sud',       'ZDS Sud'),
  ('zds', 'sud-est',   'ZDS Sud-Est');

-- Régions (13 métropolitaines + 5 d'outre-mer)
insert into public.territories (type, code, name, parent_id, is_overseas) values
  ('reg', '84', 'Auvergne-Rhône-Alpes',        'zds-sud-est',   false),
  ('reg', '27', 'Bourgogne-Franche-Comté',     null,            false),
  ('reg', '53', 'Bretagne',                    'zds-ouest',     false),
  ('reg', '24', 'Centre-Val de Loire',         null,            false),
  ('reg', '94', 'Corse',                       'zds-sud',       false),
  ('reg', '44', 'Grand Est',                   'zds-est',       false),
  ('reg', '32', 'Hauts-de-France',             'zds-nord',      false),
  ('reg', '11', 'Île-de-France',               'zds-paris',     false),
  ('reg', '28', 'Normandie',                   null,            false),
  ('reg', '75', 'Nouvelle-Aquitaine',          'zds-sud-ouest', false),
  ('reg', '76', 'Occitanie',                   'zds-sud',       false),
  ('reg', '52', 'Pays de la Loire',            'zds-ouest',     false),
  ('reg', '93', 'Provence-Alpes-Côte d''Azur', 'zds-sud',       false),
  ('reg', '01', 'Guadeloupe',                  null,            true),
  ('reg', '02', 'Martinique',                  null,            true),
  ('reg', '03', 'Guyane',                      null,            true),
  ('reg', '04', 'La Réunion',                  null,            true),
  ('reg', '06', 'Mayotte',                     null,            true);

-- Départements (96 métropolitains + 5 d'outre-mer) : code, nom, code région
insert into public.territories (type, code, name, parent_id, is_overseas)
select 'dep', d.code, d.name, 'reg-' || d.reg, d.reg in ('01', '02', '03', '04', '06')
from (values
  ('01', 'Ain', '84'), ('02', 'Aisne', '32'), ('03', 'Allier', '84'),
  ('04', 'Alpes-de-Haute-Provence', '93'), ('05', 'Hautes-Alpes', '93'), ('06', 'Alpes-Maritimes', '93'),
  ('07', 'Ardèche', '84'), ('08', 'Ardennes', '44'), ('09', 'Ariège', '76'),
  ('10', 'Aube', '44'), ('11', 'Aude', '76'), ('12', 'Aveyron', '76'),
  ('13', 'Bouches-du-Rhône', '93'), ('14', 'Calvados', '28'), ('15', 'Cantal', '84'),
  ('16', 'Charente', '75'), ('17', 'Charente-Maritime', '75'), ('18', 'Cher', '24'),
  ('19', 'Corrèze', '75'), ('2A', 'Corse-du-Sud', '94'), ('2B', 'Haute-Corse', '94'),
  ('21', 'Côte-d''Or', '27'), ('22', 'Côtes-d''Armor', '53'), ('23', 'Creuse', '75'),
  ('24', 'Dordogne', '75'), ('25', 'Doubs', '27'), ('26', 'Drôme', '84'),
  ('27', 'Eure', '28'), ('28', 'Eure-et-Loir', '24'), ('29', 'Finistère', '53'),
  ('30', 'Gard', '76'), ('31', 'Haute-Garonne', '76'), ('32', 'Gers', '76'),
  ('33', 'Gironde', '75'), ('34', 'Hérault', '76'), ('35', 'Ille-et-Vilaine', '53'),
  ('36', 'Indre', '24'), ('37', 'Indre-et-Loire', '24'), ('38', 'Isère', '84'),
  ('39', 'Jura', '27'), ('40', 'Landes', '75'), ('41', 'Loir-et-Cher', '24'),
  ('42', 'Loire', '84'), ('43', 'Haute-Loire', '84'), ('44', 'Loire-Atlantique', '52'),
  ('45', 'Loiret', '24'), ('46', 'Lot', '76'), ('47', 'Lot-et-Garonne', '75'),
  ('48', 'Lozère', '76'), ('49', 'Maine-et-Loire', '52'), ('50', 'Manche', '28'),
  ('51', 'Marne', '44'), ('52', 'Haute-Marne', '44'), ('53', 'Mayenne', '52'),
  ('54', 'Meurthe-et-Moselle', '44'), ('55', 'Meuse', '44'), ('56', 'Morbihan', '53'),
  ('57', 'Moselle', '44'), ('58', 'Nièvre', '27'), ('59', 'Nord', '32'),
  ('60', 'Oise', '32'), ('61', 'Orne', '28'), ('62', 'Pas-de-Calais', '32'),
  ('63', 'Puy-de-Dôme', '84'), ('64', 'Pyrénées-Atlantiques', '75'), ('65', 'Hautes-Pyrénées', '76'),
  ('66', 'Pyrénées-Orientales', '76'), ('67', 'Bas-Rhin', '44'), ('68', 'Haut-Rhin', '44'),
  ('69', 'Rhône', '84'), ('70', 'Haute-Saône', '27'), ('71', 'Saône-et-Loire', '27'),
  ('72', 'Sarthe', '52'), ('73', 'Savoie', '84'), ('74', 'Haute-Savoie', '84'),
  ('75', 'Paris', '11'), ('76', 'Seine-Maritime', '28'), ('77', 'Seine-et-Marne', '11'),
  ('78', 'Yvelines', '11'), ('79', 'Deux-Sèvres', '75'), ('80', 'Somme', '32'),
  ('81', 'Tarn', '76'), ('82', 'Tarn-et-Garonne', '76'), ('83', 'Var', '93'),
  ('84', 'Vaucluse', '93'), ('85', 'Vendée', '52'), ('86', 'Vienne', '75'),
  ('87', 'Haute-Vienne', '75'), ('88', 'Vosges', '44'), ('89', 'Yonne', '27'),
  ('90', 'Territoire de Belfort', '27'), ('91', 'Essonne', '11'), ('92', 'Hauts-de-Seine', '11'),
  ('93', 'Seine-Saint-Denis', '11'), ('94', 'Val-de-Marne', '11'), ('95', 'Val-d''Oise', '11'),
  ('971', 'Guadeloupe', '01'), ('972', 'Martinique', '02'), ('973', 'Guyane', '03'),
  ('974', 'La Réunion', '04'), ('976', 'Mayotte', '06')
) as d (code, name, reg);

-- Collectivités d'outre-mer (hors départements/régions) : pas de zone ni de commune
insert into public.territories (type, code, name, is_overseas) values
  ('colom', '975', 'Saint-Pierre-et-Miquelon', true),
  ('colom', '977', 'Saint-Barthélemy',         true),
  ('colom', '978', 'Saint-Martin',             true),
  ('colom', '986', 'Wallis-et-Futuna',         true),
  ('colom', '987', 'Polynésie française',      true),
  ('colom', '988', 'Nouvelle-Calédonie',       true);
