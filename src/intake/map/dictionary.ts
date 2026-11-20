import type { Kind } from './model'

/**
 * Column names recognised from the start (requirements section 6.2), as data: field to example column names.
 * Names are compared after normalising case, accents and punctuation. The open-format name and the camelCase name of
 * every field are always accepted as well. The dictionary grows as users confirm mappings (`SiteProfile.columnNames`)
 * and can hold names in any language.
 */
export const SEED_DICTIONARY: Record<Kind, Record<string, string[]>> = {
  cases: {
    caseId: [
      'Display ID', 'Case ID', 'Ticket ID', 'Ticket No', 'Ticket Number', 'Work Order', 'Work Order No', 'Job No',
      'Job Number', 'Service Request', 'SR Number', 'Complaint No', 'Complaint Number', 'Call ID', 'Docket No',
      'Auftragsnummer', 'Auftrag Nr', 'Numero de ticket', 'Numero de caso',
    ],
    workType: [
      'Category', 'Category Level 1', 'Call Type', 'Service Type', 'Job Type', 'Work Type', 'Nature of Complaint',
      'Request Type', 'Kategorie', 'Auftragsart', 'Categorie', 'Type de demande', 'Tipo de servicio', 'Categoria',
    ],
    status: ['Status', 'Stage', 'State', 'Case Status', 'Call Status', 'Zustand', 'Statut', 'Estado'],
    reportedAt: [
      'Reported on', 'Reported At', 'Reported Date', 'Created On', 'Created Date', 'Created At', 'Call Date', 'Logged On',
      'Registration Date', 'Opened At', 'Opened', 'Erstellt am', 'Erstellt', 'Date de creation', 'Fecha de creacion',
      'Fecha de registro',
    ],
    priority: ['Priority', 'Escalation Status', 'Urgency', 'Severity', 'Prioritat', 'Priorite', 'Prioridad'],
    dueAt: ['Due Date', 'Due At', 'SLA Date', 'Target Date', 'Commitment Date', 'Faellig am', 'Fallig am', 'Date d echeance', 'Fecha limite'],
    area: ['Location', 'Area', 'Locality', 'City', 'Town', 'Place', 'Ort', 'Stadt', 'Standort', 'Localite', 'Ville', 'Localidad', 'Ciudad', 'Zona'],
    postalCode: ['PIN Code', 'PIN', 'Postal Code', 'Zip', 'Zip Code', 'Postcode', 'PLZ', 'Postleitzahl', 'Code postal', 'Codigo postal'],
    address: ['Address', 'Street Address', 'Anschrift', 'Adresse', 'Direccion'],
    latitude: ['Latitude', 'Lat', 'Breitengrad', 'Latitud'],
    longitude: ['Longitude', 'Lng', 'Lon', 'Long', 'Laengengrad', 'Langengrad', 'Longitud'],
    productType: ['Product Type', 'Product', 'Model', 'Equipment', 'Unit Type', 'Produkt', 'Geraet', 'Produit', 'Producto'],
    durationMin: ['Duration', 'Duration Min', 'Duration Minutes', 'Minutes', 'Dauer', 'Duree', 'Duracion'],
    earliestDate: ['Earliest Date', 'Not Before', 'Available From', 'Fruhester Termin'],
    technician: ['Technician', 'Engineer', 'Assigned To', 'Assigned Technician', 'Techniker', 'Technicien', 'Tecnico'],
    customerName: ['Customer', 'Customer Name', 'Contact Name', 'Client', 'Kunde', 'Kundenname', 'Nom du client', 'Cliente'],
    notes: ['Notes', 'Subject', 'Remarks', 'Description', 'Comments', 'Bemerkung', 'Notizen', 'Remarques', 'Notas'],
    otherRef: ['Reference', 'Other Ref', 'Other Reference', 'Ref'],
  },
  technicians: {
    name: ['Name', 'Technician', 'Engineer', 'Executive', 'Employee', 'Staff', 'Technician Name', 'Techniker', 'Mitarbeiter', 'Technicien', 'Tecnico'],
    skills: ['Work', 'Skill', 'Skills', 'Trade', 'Specialisation', 'Specialization', 'Role', 'Qualifikation', 'Fertigkeiten', 'Competences', 'Habilidades'],
    active: ['Active', 'Is Active', 'Aktiv', 'Actif', 'Activo'],
    leaveFrom: ['Leave From', 'Leave Start', 'Absent From', 'Urlaub von'],
    leaveTo: ['Leave To', 'Leave End', 'Absent To', 'Urlaub bis'],
    startArea: ['Start Area', 'Start Place', 'Start Location', 'Home Area', 'Home', 'Depot', 'Startort'],
    startLatitude: ['Start Latitude', 'Start Lat', 'Home Lat'],
    startLongitude: ['Start Longitude', 'Start Lng', 'Start Lon', 'Home Lon'],
    endArea: ['End Area', 'End Place', 'End Location', 'Zielort'],
    endLatitude: ['End Latitude', 'End Lat'],
    endLongitude: ['End Longitude', 'End Lng', 'End Lon'],
    shiftStart: ['Shift Start', 'Start Time', 'Day Start', 'Dienstbeginn'],
    shiftHours: ['Shift Hours', 'Working Hours', 'Hours', 'Shift Length', 'Arbeitsstunden'],
    breakMin: ['Break', 'Break Min', 'Break Minutes', 'Lunch Break', 'Pause'],
  },
  places: {
    area: ['Place', 'Area', 'Locality', 'Name', 'Place Name', 'Ort', 'Localite', 'Localidad'],
    latitude: ['Latitude', 'Lat', 'Breitengrad', 'Latitud'],
    longitude: ['Longitude', 'Lng', 'Lon', 'Long', 'Laengengrad', 'Langengrad', 'Longitud'],
    postalCode: ['PIN Code', 'PIN', 'Postal Code', 'Zip', 'Zip Code', 'Postcode', 'PLZ', 'Postleitzahl', 'Code postal', 'Codigo postal'],
    zone: ['Zone', 'Region', 'Sector'],
  },
}

/** Column names that usually hold personal data of a customer (cases only). They stay unmapped by default. */
export const PERSONAL_NAMES: string[] = [
  'Phone', 'Mobile', 'Telephone', 'Tel', 'Email', 'E-mail', 'Contact No', 'Contact Number', 'Customer Phone',
  'Customer Mobile', 'Customer Email', 'Telefon', 'Handy', 'Telefono',
]
