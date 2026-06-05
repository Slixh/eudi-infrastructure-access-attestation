import { PrismaClient, GrantStatus } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import * as path from 'path'
import 'dotenv/config'

const dbUrl = (process.env.DATABASE_URL ?? 'file:./dev.db').replace('file:', '')
const adapter = new PrismaBetterSqlite3({ url: path.resolve(dbUrl) })
const prisma = new PrismaClient({ adapter } as any)

// ── Locations ─────────────────────────────────────────────────────────────────

const LOCATIONS = [
  { id: 'de-berlin',       name: 'Rechenzentrum Berlin-Mitte',       street: 'Unter den Linden 77',        postalCode: '10117', city: 'Berlin'            },
  { id: 'de-hamburg',      name: 'Datacenter Hamburg Hafen',          street: 'Kajen 12',                   postalCode: '20459', city: 'Hamburg'           },
  { id: 'de-muenchen',     name: 'IT-Zentrum München Maxvorstadt',    street: 'Gabelsbergerstraße 35',       postalCode: '80333', city: 'München'           },
  { id: 'de-koeln',        name: 'Rechenzentrum Köln-Innenstadt',     street: 'Hohe Straße 47',             postalCode: '50667', city: 'Köln'              },
  { id: 'de-frankfurt',    name: 'Datacenter Frankfurt Bankenviertel',street: 'Kaiserstraße 29',            postalCode: '60311', city: 'Frankfurt am Main' },
  { id: 'de-stuttgart',    name: 'IT-Hub Stuttgart Mitte',            street: 'Königstraße 5',              postalCode: '70173', city: 'Stuttgart'         },
  { id: 'de-duesseldorf',  name: 'RZ Düsseldorf Medienhafen',         street: 'Speditionstraße 17',         postalCode: '40221', city: 'Düsseldorf'        },
  { id: 'de-leipzig',      name: 'Datacenter Leipzig Augustusplatz',  street: 'Augustusplatz 12',           postalCode: '04109', city: 'Leipzig'           },
  { id: 'de-dortmund',     name: 'IT-Gebäude Dortmund Innenstadt',    street: 'Westenhellweg 110',          postalCode: '44137', city: 'Dortmund'          },
  { id: 'de-essen',        name: 'Rechenzentrum Essen Campus',        street: 'Universitätsstraße 2',       postalCode: '45141', city: 'Essen'             },
  { id: 'de-bremen',       name: 'Datacenter Bremen Überseestadt',    street: 'Konsul-Smidt-Straße 8',      postalCode: '28217', city: 'Bremen'            },
  { id: 'de-dresden',      name: 'IT-Zentrum Dresden Neustadt',       street: 'Königsbrücker Straße 96',    postalCode: '01099', city: 'Dresden'           },
  { id: 'de-hannover',     name: 'Rechenzentrum Hannover Messe',      street: 'Messegelände 1',             postalCode: '30521', city: 'Hannover'          },
  { id: 'de-nuernberg',    name: 'Datacenter Nürnberg Altstadt',      street: 'Königstraße 8',              postalCode: '90402', city: 'Nürnberg'          },
  { id: 'de-duisburg',     name: 'IT-Hub Duisburg Ruhrort',           street: 'Dammstraße 33',              postalCode: '47119', city: 'Duisburg'          },
  { id: 'de-bochum',       name: 'Rechenzentrum Bochum Universität',  street: 'Universitätsstraße 150',     postalCode: '44801', city: 'Bochum'            },
  { id: 'de-wuppertal',    name: 'Datacenter Wuppertal Elberfeld',    street: 'Herzogstraße 60',            postalCode: '42103', city: 'Wuppertal'         },
  { id: 'de-bielefeld',    name: 'IT-Zentrum Bielefeld Mitte',        street: 'Bahnhofstraße 25',           postalCode: '33602', city: 'Bielefeld'         },
  { id: 'de-bonn',         name: 'Rechenzentrum Bonn Zentrum',        street: 'Friedensplatz 2',            postalCode: '53111', city: 'Bonn'              },
  { id: 'de-muenster',     name: 'Datacenter Münster Innenstadt',     street: 'Prinzipalmarkt 8',           postalCode: '48143', city: 'Münster'           },
  { id: 'de-karlsruhe',    name: 'IT-Hub Karlsruhe Technologiepark',  street: 'Vincenz-Prießnitz-Straße 3', postalCode: '76131', city: 'Karlsruhe'         },
  { id: 'de-mannheim',     name: 'Rechenzentrum Mannheim Quadrate',   street: 'N1 12',                      postalCode: '68161', city: 'Mannheim'          },
  { id: 'de-augsburg',     name: 'Datacenter Augsburg Maximilianviertel', street: 'Maximilianstraße 45',    postalCode: '86150', city: 'Augsburg'          },
  { id: 'de-wiesbaden',    name: 'IT-Gebäude Wiesbaden City',         street: 'Kirchgasse 12',              postalCode: '65183', city: 'Wiesbaden'         },
  { id: 'de-gelsenkirchen',name: 'Rechenzentrum Gelsenkirchen Mitte', street: 'Bahnhofstraße 4',            postalCode: '45879', city: 'Gelsenkirchen'     },
  { id: 'de-duelmen',      name: 'IT-Standort Dülmen',                street: 'Münsterstraße 10',           postalCode: '48249', city: 'Dülmen'            },
  { id: 'de-hilchenbach',  name: 'Rechenzentrum Hilchenbach Siegerland', street: 'Markt 13',               postalCode: '57271', city: 'Hilchenbach'       },
] as const

// ── Resources per location ────────────────────────────────────────────────────

type ResourceSeed = { id: string; locationId: string; name: string; identifier: string; description: string }

function res(locationId: string, suffix: string, name: string, identifier: string, description: string): ResourceSeed {
  return { id: `res-${locationId.replace('de-', '')}-${suffix}`, locationId, name, identifier, description }
}

const RESOURCES: ResourceSeed[] = [
  // Berlin
  res('de-berlin', 'rz-hg',   'Rechenzentrum Hauptzugang',    'dc:berlin:rz-hauptgebaeude:eingang',     'Haupteingang mit Schleuse zum Rechenzentrum'),
  res('de-berlin', 'srv-eg',  'Serverraum Erdgeschoss',        'dc:berlin:rz-hauptgebaeude:server-eg',   'Primäre Serverinfrastruktur, Rack-Reihen A–D'),
  res('de-berlin', 'noc',     'Network Operations Center',     'dc:berlin:rz-hauptgebaeude:noc',         '24/7-überwachter NOC-Raum, 2. OG'),
  res('de-berlin', 'usv',     'USV- und Energieraum',          'dc:berlin:rz-hauptgebaeude:usv',         'Unterbrechungsfreie Stromversorgung und Traforaum'),

  // Hamburg
  res('de-hamburg', 'srv-1',  'Serverraum Nord',               'dc:hamburg:hafen:server-nord',           'Serverraum nördlicher Gebäudeflügel'),
  res('de-hamburg', 'patch',  'Patchraum Netzwerk',            'dc:hamburg:hafen:patchraum',             'Patchpanel und Switch-Infrastruktur'),
  res('de-hamburg', 'backup', 'Backup-Systeme',                'dc:hamburg:hafen:backup',                'Bandbibliothek und Backup-Server'),

  // München
  res('de-muenchen', 'srv-eg', 'Serverraum EG',                'dc:muenchen:maxvorstadt:server-eg',      'Hauptserverraum Erdgeschoss'),
  res('de-muenchen', 'klimat', 'Klimatechnik und Kühlung',     'dc:muenchen:maxvorstadt:klimaanlage',    'Präzisionsklimaanlage für Serverräume'),
  res('de-muenchen', 'dmz',    'DMZ-Bereich',                  'dc:muenchen:maxvorstadt:dmz',            'Demilitarisierte Zone, Firewall-Systeme'),

  // Köln
  res('de-koeln', 'rz-eg',    'Rechenzentrum EG',              'dc:koeln:innenstadt:rz-eg',              'Hauptrechenzentrum Erdgeschoss'),
  res('de-koeln', 'srv-2og',  'Serverraum 2. OG',              'dc:koeln:innenstadt:server-2og',         'Ausweichserverraum zweites Obergeschoss'),
  res('de-koeln', 'netzwerk', 'Netzwerkkeller',                'dc:koeln:innenstadt:netzwerk-keller',    'Core-Router und Switching-Infrastruktur'),

  // Frankfurt
  res('de-frankfurt', 'coloc',   'Colocation-Bereich A',        'dc:frankfurt:bankenviertel:coloc-a',     'Colocation-Käfige Bereich A'),
  res('de-frankfurt', 'coloc-b', 'Colocation-Bereich B',        'dc:frankfurt:bankenviertel:coloc-b',     'Colocation-Käfige Bereich B'),
  res('de-frankfurt', 'cross',   'Cross-Connect-Raum',          'dc:frankfurt:bankenviertel:cross-connect','Carrier-Übergabepunkte und Glasfaser-Termination'),
  res('de-frankfurt', 'ops',     'Operations-Raum',             'dc:frankfurt:bankenviertel:ops',         'Techniker-Arbeitsbereich und Staging-Zone'),

  // Stuttgart
  res('de-stuttgart', 'srv',  'Serverraum Hauptgebäude',       'dc:stuttgart:mitte:server-hg',           'Zentraler Serverraum'),
  res('de-stuttgart', 'tk',   'Technikraum Dach',              'dc:stuttgart:mitte:technik-dach',        'Antennentechnik und Richtfunk'),

  // Düsseldorf
  res('de-duesseldorf', 'srv',   'Serverraum Medienhafen',      'dc:duesseldorf:medienhafen:server',      'Serverinfrastruktur im Medienhafen-Gebäude'),
  res('de-duesseldorf', 'fiber', 'Glasfaser-Verteilerraum',     'dc:duesseldorf:medienhafen:fiber',       'Glasfaser-Termination und Patchfeld'),

  // Leipzig
  res('de-leipzig', 'srv',    'Serverraum Augustusplatz',      'dc:leipzig:augustusplatz:server',        'Hauptserverraum'),
  res('de-leipzig', 'noc',    'NOC Leipzig',                   'dc:leipzig:augustusplatz:noc',           'Netzwerk-Überwachungsraum'),

  // Dortmund
  res('de-dortmund', 'srv-a', 'Serverraum A',                  'dc:dortmund:innenstadt:server-a',        'Serverraum westlicher Trakt'),
  res('de-dortmund', 'srv-b', 'Serverraum B',                  'dc:dortmund:innenstadt:server-b',        'Serverraum östlicher Trakt'),
  res('de-dortmund', 'usv',   'Stromversorgung und USV',       'dc:dortmund:innenstadt:usv',             'Energieversorgung und unterbrechungsfreie Stromversorgung'),

  // Essen
  res('de-essen', 'srv',      'Serverraum Campus',             'dc:essen:campus:server',                 'Campusrechenzentrum Hauptraum'),
  res('de-essen', 'hpc',      'HPC-Cluster-Bereich',           'dc:essen:campus:hpc',                   'Hochleistungsrechner-Cluster'),

  // Bremen
  res('de-bremen', 'srv',     'Serverraum Überseestadt',       'dc:bremen:ueberseestadt:server',         'Serverinfrastruktur'),
  res('de-bremen', 'san',     'SAN-Storage-Raum',              'dc:bremen:ueberseestadt:san',            'Storage Area Network und NAS-Systeme'),

  // Dresden
  res('de-dresden', 'srv',    'Serverraum Neustadt',           'dc:dresden:neustadt:server',             'Hauptserverraum'),
  res('de-dresden', 'backup', 'Backup und Archiv',             'dc:dresden:neustadt:backup-archiv',      'Langzeitarchivierung und Datensicherung'),

  // Hannover
  res('de-hannover', 'srv',   'Serverraum Messe',              'dc:hannover:messe:server',               'Messeinfrastruktur-Server'),
  res('de-hannover', 'net',   'Netzwerkzentrale',              'dc:hannover:messe:netzwerk',             'Netzwerkinfrastruktur Messegelände'),

  // Nürnberg
  res('de-nuernberg', 'srv',  'Serverraum Altstadt',           'dc:nuernberg:altstadt:server',           'Zentraler Serverraum'),
  res('de-nuernberg', 'patch','Patchraum',                     'dc:nuernberg:altstadt:patch',            'Patchpanel und Kabelmanagement'),

  // Duisburg
  res('de-duisburg', 'srv',   'Serverraum Ruhrort',            'dc:duisburg:ruhrort:server',             'Hauptserverraum'),
  res('de-duisburg', 'fiber', 'Glasfaser-Hub',                 'dc:duisburg:ruhrort:fiber-hub',          'Glasfaser-Knotenpunkt Ruhrgebiet'),

  // Bochum
  res('de-bochum', 'srv',     'Serverraum Universität',        'dc:bochum:uni:server',                   'Universitätsrechenzentrum'),
  res('de-bochum', 'forsch',  'Forschungsserver-Bereich',      'dc:bochum:uni:forschung',                'Dedizierte Forschungsinfrastruktur'),

  // Wuppertal
  res('de-wuppertal', 'srv',  'Serverraum Elberfeld',          'dc:wuppertal:elberfeld:server',          'Hauptserverraum'),
  res('de-wuppertal', 'tk',   'Technikraum',                   'dc:wuppertal:elberfeld:technik',         'Gebäudetechnik und IT-Infrastruktur'),

  // Bielefeld
  res('de-bielefeld', 'srv',  'Serverraum Mitte',              'dc:bielefeld:mitte:server',              'Zentraler Serverraum'),
  res('de-bielefeld', 'noc',  'NOC Bielefeld',                 'dc:bielefeld:mitte:noc',                 'Netzwerküberwachung'),

  // Bonn
  res('de-bonn', 'srv',       'Serverraum Zentrum',            'dc:bonn:zentrum:server',                 'Hauptserverraum'),
  res('de-bonn', 'gov',       'Behörden-Infrastruktur',        'dc:bonn:zentrum:behoerden-infra',        'Gesicherter Bereich für Behörden-IT'),

  // Münster
  res('de-muenster', 'srv',   'Serverraum Innenstadt',         'dc:muenster:innenstadt:server',          'Zentraler Serverraum'),
  res('de-muenster', 'san',   'Storage-Bereich',               'dc:muenster:innenstadt:storage',         'SAN und NAS-Infrastruktur'),

  // Karlsruhe
  res('de-karlsruhe', 'srv',  'Serverraum Technologiepark',    'dc:karlsruhe:technologiepark:server',    'IT-Infrastruktur Technologiepark'),
  res('de-karlsruhe', 'hpc',  'KI- und HPC-Labor',            'dc:karlsruhe:technologiepark:hpc-ki',    'GPU-Cluster für KI-Workloads'),

  // Mannheim
  res('de-mannheim', 'srv',   'Serverraum Quadrate',           'dc:mannheim:quadrate:server',            'Hauptserverraum'),
  res('de-mannheim', 'net',   'Netzwerkraum',                  'dc:mannheim:quadrate:netzwerk',          'Core-Switching und Router'),

  // Augsburg
  res('de-augsburg', 'srv',   'Serverraum Maximilianviertel',  'dc:augsburg:maximilianviertel:server',   'Zentraler Serverraum'),
  res('de-augsburg', 'backup','Backup-Center',                 'dc:augsburg:maximilianviertel:backup',   'Datensicherungssysteme'),

  // Wiesbaden
  res('de-wiesbaden', 'srv',  'Serverraum City',               'dc:wiesbaden:city:server',               'Hauptserverraum'),
  res('de-wiesbaden', 'dmz',  'DMZ Wiesbaden',                 'dc:wiesbaden:city:dmz',                  'Demilitarisierte Zone'),

  // Gelsenkirchen
  res('de-gelsenkirchen', 'srv', 'Serverraum Mitte',           'dc:gelsenkirchen:mitte:server',          'Zentraler Serverraum'),
  res('de-gelsenkirchen', 'net', 'Netzwerkkeller',             'dc:gelsenkirchen:mitte:netzwerk',        'Netzwerkinfrastruktur'),

  // Dülmen
  res('de-duelmen', 'srv',    'Serverraum Dülmen',             'dc:duelmen:hauptgebaeude:server',        'Lokaler Serverraum'),
  res('de-duelmen', 'patch',  'Patchraum',                     'dc:duelmen:hauptgebaeude:patch',         'Patchpanel und Netzwerkverteilung'),
  res('de-duelmen', 'tk',     'Technikraum EG',                'dc:duelmen:hauptgebaeude:technik-eg',    'Gebäudetechnik und lokale IT'),

  // Hilchenbach
  res('de-hilchenbach', 'srv',  'Serverraum Siegerland',       'dc:hilchenbach:siegerland:server',       'Zentraler Serverraum Standort Hilchenbach'),
  res('de-hilchenbach', 'backup','Backup-Raum',                'dc:hilchenbach:siegerland:backup',       'Datensicherung und Archivierung'),
  res('de-hilchenbach', 'net',  'Netzwerkverteiler',           'dc:hilchenbach:siegerland:netzwerk',     'Netzwerkinfrastruktur und Glasfaser-Einspeisung'),
]

// ── Grants (ACTIVE — already issued) ─────────────────────────────────────────

const GRANTS = [
  { id: 'grant-001', label: 'Serverraum Berlin – Thomas Müller',     resourceId: 'dc:berlin:rz-hauptgebaeude:server-eg',    resourceEntityId: 'res-berlin-srv-eg',   status: GrantStatus.ACTIVE,  pidSubject: 'thomas.mueller:1985-03-14', credentialId: 'cred-001' },
  { id: 'grant-002', label: 'NOC Berlin – Anna Schmidt',             resourceId: 'dc:berlin:rz-hauptgebaeude:noc',          resourceEntityId: 'res-berlin-noc',      status: GrantStatus.ACTIVE,  pidSubject: 'anna.schmidt:1990-07-22',   credentialId: 'cred-002' },
  { id: 'grant-003', label: 'Rechenzentrum Frankfurt – Julia Weber', resourceId: 'dc:frankfurt:bankenviertel:coloc-a',       resourceEntityId: 'res-frankfurt-coloc', status: GrantStatus.ACTIVE,  pidSubject: 'julia.weber:1988-11-05',    credentialId: 'cred-003' },
  { id: 'grant-004', label: 'Serverraum München – Klaus Bauer',      resourceId: 'dc:muenchen:maxvorstadt:server-eg',        resourceEntityId: 'res-muenchen-srv-eg', status: GrantStatus.ACTIVE,  pidSubject: 'klaus.bauer:1979-04-30',    credentialId: 'cred-004' },
  { id: 'grant-005', label: 'NOC München – Sandra Fischer',          resourceId: 'dc:muenchen:maxvorstadt:dmz',             resourceEntityId: 'res-muenchen-dmz',    status: GrantStatus.ACTIVE,  pidSubject: 'sandra.fischer:1993-09-12', credentialId: 'cred-005' },
  { id: 'grant-006', label: 'Serverraum Hamburg – Markus Wagner',    resourceId: 'dc:hamburg:hafen:server-nord',            resourceEntityId: 'res-hamburg-srv-1',   status: GrantStatus.ACTIVE,  pidSubject: 'markus.wagner:1982-02-28',  credentialId: 'cred-006' },
  { id: 'grant-007', label: 'Serverraum Dülmen – Erika Becker',      resourceId: 'dc:duelmen:hauptgebaeude:server',         resourceEntityId: 'res-duelmen-srv',     status: GrantStatus.ACTIVE,  pidSubject: 'erika.becker:1975-06-17',   credentialId: 'cred-007' },
  { id: 'grant-008', label: 'Netzwerk Dülmen – Lukas Hoffmann',      resourceId: 'dc:duelmen:hauptgebaeude:patch',          resourceEntityId: 'res-duelmen-patch',   status: GrantStatus.ACTIVE,  pidSubject: 'lukas.hoffmann:1995-01-08', credentialId: 'cred-008' },
  { id: 'grant-009', label: 'Serverraum Hilchenbach – Petra Schulz', resourceId: 'dc:hilchenbach:siegerland:server',        resourceEntityId: 'res-hilchenbach-srv', status: GrantStatus.ACTIVE,  pidSubject: 'petra.schulz:1987-12-03',   credentialId: 'cred-009' },
  { id: 'grant-010', label: 'HPC Karlsruhe – Dr. Michael Braun',     resourceId: 'dc:karlsruhe:technologiepark:hpc-ki',     resourceEntityId: 'res-karlsruhe-hpc',   status: GrantStatus.ACTIVE,  pidSubject: 'michael.braun:1980-08-25',  credentialId: 'cred-010' },
  // Pending — not yet claimed
  { id: 'grant-011', label: 'Serverraum Köln – Neue Stelle',         resourceId: 'dc:koeln:innenstadt:rz-eg',               resourceEntityId: 'res-koeln-rz-eg',     status: GrantStatus.PENDING, pidSubject: null,                        credentialId: null       },
  { id: 'grant-012', label: 'Backup Stuttgart – Wartungszugang',     resourceId: 'dc:stuttgart:mitte:server-hg',            resourceEntityId: 'res-stuttgart-srv',   status: GrantStatus.PENDING, pidSubject: null,                        credentialId: null       },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...')

  // Locations
  console.log(`  → ${LOCATIONS.length} locations`)
  for (const loc of LOCATIONS) {
    await prisma.location.upsert({
      where:  { id: loc.id },
      update: { name: loc.name, street: loc.street, postalCode: loc.postalCode, city: loc.city },
      create: { ...loc, country: 'DE' },
    })
  }

  // Resources
  console.log(`  → ${RESOURCES.length} resources`)
  for (const r of RESOURCES) {
    await prisma.resource.upsert({
      where:  { id: r.id },
      update: { name: r.name, description: r.description },
      create: r,
    })
  }

  // Grants
  console.log(`  → ${GRANTS.length} grants`)
  for (const g of GRANTS) {
    await prisma.grant.upsert({
      where:  { id: g.id },
      update: { status: g.status },
      create: {
        id:              g.id,
        label:           g.label,
        resourceId:      g.resourceId,
        resourceEntityId:g.resourceEntityId,
        status:          g.status,
        pidSubject:      g.pidSubject,
        credentialId:    g.credentialId,
      },
    })
  }

  console.log('✅ Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
