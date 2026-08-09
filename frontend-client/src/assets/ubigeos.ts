export interface UbigeoMap {
  [departamento: string]: {
    [provincia: string]: string[];
  };
}

export const DEPARTAMENTOS_PERU = [
  'Lima',
  'Callao',
  'Arequipa',
  'La Libertad',
  'Lambayeque',
  'Piura',
  'Junín',
  'Ancash',
  'Cusco',
  'Ica',
  'Cajamarca',
  'Loreto',
  'San Martín',
  'Puno',
  'Tacna',
  'Huánuco',
  'Ayacucho',
  'Ucayali',
  'Amazonas',
  'Apurímac',
  'Huancavelica',
  'Madre de Dios',
  'Moquegua',
  'Pasco',
  'Tumbes'
];

export const UBIGEO_DATA: UbigeoMap = {
  'Lima': {
    'Lima': [
      'Lima', 'Ancón', 'Ate', 'Barranco', 'Breña', 'Carabayllo', 'Chaclacayo', 'Chorrillos', 
      'Cieneguilla', 'Comas', 'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 
      'La Victoria', 'Lince', 'Los Olivos', 'Lurigancho', 'Lurín', 'Magdalena del Mar', 
      'Miraflores', 'Pachacámac', 'Pucusana', 'Pueblo Libre', 'Puente Piedra', 'Punta Hermosa', 
      'Punta Negra', 'Rímac', 'San Bartolo', 'San Borja', 'San Isidro', 'San Juan de Lurigancho', 
      'San Juan de Miraflores', 'San Luis', 'San Martín de Porres', 'San Miguel', 'Santa Anita', 
      'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco', 'Surquillo', 'Villa El Salvador', 
      'Villa María del Triunfo'
    ],
    'Cañete': ['San Vicente de Cañete', 'Asia', 'Calango', 'Cerro Azul', 'Coayllo', 'Imperial', 'Lunahuaná', 'Mala', 'Nuevo Imperial', 'Pacarán', 'Quilmaná', 'San Antonio', 'Santa Cruz de Flores'],
    'Huaura': ['Huacho', 'Ambar', 'Carquín', 'Checras', 'Hualmay', 'Huaura', 'Leoncio Prado', 'Paccho', 'Santa María', 'Sayán', 'Végueta'],
    'Huaral': ['Huaral', 'Chancay', 'Aucallama', 'Ihuarí', 'Lampián', 'Pacaraos', 'San Miguel de Acos', 'Santa Cruz de Andamarca', 'Atavillos Alto', 'Atavillos Bajo'],
    'Barranca': ['Barranca', 'Paramonga', 'Pativilca', 'Supe', 'Supe Puerto'],
    'Huarochirí': ['Matucana', 'Antioquía', 'Callahuanca', 'Chicla', 'Chosica', 'Ricardo Palma', 'San Mateo', 'Santa Eulalia', 'Surco'],
    'Canta': ['Canta', 'Arahuay', 'Huamantanga', 'Lachaqui', 'San Buenaventura', 'Santa Rosa de Quives'],
    'Yauyos': ['Yauyos', 'Alis', 'Ayaví', 'Carania', 'Laraos', 'Tomas', 'Tauripampa'],
    'Oyón': ['Oyón', 'Andajes', 'Caujul', 'Cochamarca', 'Naván', 'Paccho'],
    'Cajatambo': ['Cajatambo', 'Copa', 'Gorgor', 'Huancapón', 'Manás']
  },
  'Callao': {
    'Callao': ['Callao', 'Bellavista', 'Carmen de la Legua', 'La Perla', 'La Punta', 'Ventanilla', 'Mi Perú']
  },
  'Arequipa': {
    'Arequipa': [
      'Arequipa', 'Alto Selva Alegre', 'Cayma', 'Cerro Colorado', 'Characato', 'Chiguata', 
      'Jacobo Hunter', 'José Luis Bustamante y Rivero', 'La Joya', 'Mariano Melgar', 'Miraflores', 
      'Mollebaya', 'Paucarpata', 'Pocsi', 'Polobaya', 'Quequeña', 'Sabandía', 'Sachaca', 
      'Socabaya', 'Tiabaya', 'Uchumayo', 'Vítor', 'Yanahuara', 'Yarabamba', 'Yura'
    ],
    'Camaná': ['Camaná', 'José María Quimper', 'Mariano Nicolás Valcárcel', 'Mariscal Cáceres', 'Nicolás de Piérola', 'Ocoña', 'Quilca', 'Samuel Pastor'],
    'Islay': ['Mollendo', 'Cocachacra', 'Dean Valdivia', 'Islay', 'Mejía', 'Punta de Bombón'],
    'Caylloma': ['Chivay', 'Achoma', 'Cabanaconde', 'Callalli', 'Coporaque', 'Maca', 'Madrigal', 'Majes', 'Yanque'],
    'Caravelí': ['Caravelí', 'Acarí', 'Atico', 'Chala', 'Lomas', 'Quicacha', 'Yauca'],
    'Castilla': ['Aplao', 'Andagua', 'Chachas', 'Chilcaymarca', 'Orcopampa', 'Pampacolca', 'Tipán', 'Uñón', 'Viraco'],
    'Condesuyos': ['Chuquibamba', 'Andaray', 'Cayarani', 'Chichas', 'Iray', 'Río Grande', 'Salamanca', 'Yanaquihua'],
    'La Unión': ['Cotahuasi', 'Alca', 'Charcana', 'Puyca', 'Quechualla', 'Sayla', 'Tauría', 'Tomepampa']
  },
  'La Libertad': {
    'Trujillo': [
      'Trujillo', 'El Porvenir', 'Florencia de Mora', 'Huanchaco', 'La Esperanza', 'Laredo', 
      'Moche', 'Poroto', 'Salaverry', 'Simbal', 'Víctor Larco Herrera'
    ],
    'Virú': ['Virú', 'Chao', 'Guadalupito'],
    'Pacasmayo': ['San Pedro de Lloc', 'Guadalupe', 'Jequetepeque', 'Pacasmayo', 'San José'],
    'Chepén': ['Chepén', 'Pacanga', 'Pueblo Nuevo'],
    'Ascope': ['Ascope', 'Chicama', 'Chocope', 'Magdalena de Cao', 'Paiján', 'Rázuri', 'Santiago de Cao', 'Casa Grande'],
    'Sánchez Carrión': ['Huamachuco', 'Chugay', 'Curgos', 'Marcabal', 'Sanagorán', 'Sartimbamba'],
    'Otuzco': ['Otuzco', 'Agallpampa', 'Charat', 'Mache', 'Sinsicap', 'Usquil'],
    'Santiago de Chuco': ['Santiago de Chuco', 'Angasmarca', 'Cachicadán', 'Mollebamba', 'Mollepata', 'Quiruvilca'],
    'Gran Chimú': ['Cascas', 'Lucma', 'Marmot', 'Sayapullo'],
    'Julcán': ['Julcán', 'Calamarca', 'Carabamba', 'Huaso'],
    'Pataz': ['Tayabamba', 'Buldibuyo', 'Chillia', 'Huancaspata', 'Pataz', 'Pías'],
    'Bolívar': ['Bolívar', 'Bambamarca', 'Condormarca', 'Longotea', 'Uchumarca']
  },
  'Lambayeque': {
    'Chiclayo': [
      'Chiclayo', 'Chongoyape', 'Eten', 'Eten Puerto', 'José Leonardo Ortiz', 'La Victoria', 
      'Lagunas', 'Monsefú', 'Nueva Arica', 'Oyotún', 'Picsi', 'Pimentel', 'Reque', 'Saña', 
      'Santa Rosa', 'Tumán', 'Pátapo', 'Pomalca', 'Pucalá'
    ],
    'Lambayeque': ['Lambayeque', 'Chochope', 'Illimo', 'Jayanca', 'Mochumí', 'Morrope', 'Motupe', 'Olmos', 'Pacora', 'Salas', 'San José', 'Túcume'],
    'Ferreñafe': ['Ferreñafe', 'Cañaris', 'Incahuasi', 'Manuel Antonio Mesones Muro', 'Pitipo', 'Pueblo Nuevo']
  },
  'Piura': {
    'Piura': ['Piura', 'Castilla', 'Catacaos', 'Cura Mori', 'El Tallán', 'La Arena', 'La Unión', 'Las Lomas', 'Tambogrande', 'Veintiséis de Octubre'],
    'Sullana': ['Sullana', 'Bellavista', 'Ignacio Escudero', 'Lancones', 'Marcavelica', 'Miguel Checa', 'Querecotillo', 'Salitral'],
    'Talara': ['Pariñas', 'El Alto', 'La Brea', 'Lobitos', 'Los Órganos', 'Máncora'],
    'Paita': ['Paita', 'Amotape', 'Arenal', 'Colán', 'La Huaca', 'Tamarindo', 'Vichayal'],
    'Morropón': ['Chulucanas', 'Buenos Aires', 'Chalaco', 'Morropón', 'Salitral', 'San Juan de Bigote', 'Santa Catalina de Mossa', 'Santo Domingo', 'Yamango'],
    'Ayabaca': ['Ayabaca', 'Frías', 'Jililí', 'Lagunas', 'Montero', 'Pacaipampa', 'Sícchez', 'Suyo'],
    'Huancabamba': ['Huancabamba', 'Canchaque', 'El Carmen de la Frontera', 'Huarmaca', 'Lalaquiz', 'San Miguel de El Faique', 'Sondor', 'Sondorillo'],
    'Sechura': ['Sechura', 'Bellavista de la Unión', 'Bernal', 'Cristo Nos Valga', 'Vice', 'Rinconada Llicuar']
  },
  'Junín': {
    'Huancayo': ['Huancayo', 'Chilca', 'El Tambo', 'Huancán', 'Huayucachi', 'Pilcomayo', 'San Agustín', 'San Jerónimo de Tunán', 'Sicaya', 'Sapallanga', 'Viques'],
    'Chanchamayo': ['La Merced', 'San Ramón', 'Vitoc', 'San Luis de Shuaro', 'Pichanaqui', 'Perené'],
    'Satipo': ['Satipo', 'Covivirí', 'Mazamari', 'Pampa Hermosa', 'Pangoa', 'Río Negro', 'Río Tambo'],
    'Tarma': ['Tarma', 'Acobamba', 'Huaricolca', 'Huasahuasi', 'Palca', 'Palcamayo', 'San Pedro de Cajas', 'Tapo'],
    'Yauli': ['La Oroya', 'Chacapalpa', 'Huay-Huay', 'Marcapomacocha', 'Morococha', 'Paccha', 'Santa Bárbara de Carhuacayán', 'Suitucancha', 'Yauli'],
    'Chupaca': ['Chupaca', 'Ahuac', 'Chongos Bajo', 'Huáchac', 'San Juan de Iscos', 'San Juan de Jarpa', 'Tres de Diciembre'],
    'Concepción': ['Concepción', 'Aco', 'Andamarca', 'Cocharcas', 'Heroínas Toledo', 'Mito', 'Nueve de Julio', 'Orcotuna', 'San José de Quero'],
    'Jauja': ['Jauja', 'Acolla', 'Apata', 'El Mantaro', 'Huamalí', 'Llocllapampa', 'Muqui', 'Paca', 'Sausa', 'Yauyos']
  },
  'Ancash': {
    'Huaraz': ['Huaraz', 'Independencia', 'Cochabamba', 'Colcabamba', 'Huanchay', 'Jangas', 'La Libertad', 'Olleros', 'Pira', 'Tarica'],
    'Santa': ['Chimbote', 'Coishco', 'Macate', 'Moro', 'Nepeña', 'Nuevo Chimbote', 'Samanco', 'Santa', 'Cáceres del Perú'],
    'Huari': ['Huari', 'Chavín de Huántar', 'Huantar', 'Masin', 'Ponto', 'Rahuapampa', 'San Marcos'],
    'Carhuaz': ['Carhuaz', 'Acopampa', 'Amashca', 'Anta', 'Marcará', 'San Miguel de Aco', 'Yungar'],
    'Yungay': ['Yungay', 'Cascapara', 'Mancos', 'Quillo', 'Ranrahirca', 'Shupluy'],
    'Huaylas': ['Caraz', 'Huallanca', 'Huata', 'Pamparomás', 'Pueblo Libre', 'Santa Cruz']
  },
  'Cusco': {
    'Cusco': ['Cusco', 'Ccorca', 'Poroy', 'San Jerónimo', 'San Sebastián', 'Santiago', 'Saylla', 'Wanchaq'],
    'La Convención': ['Santa Ana', 'Echarate', 'Huayopata', 'Maranura', 'Ocobamba', 'Quellouno', 'Santa Teresa', 'Vilcabamba', 'Pichari', 'Kimbiri'],
    'Urubamba': ['Urubamba', 'Chinchero', 'Huayllabamba', 'Machupicchu', 'Maras', 'Ollantaytambo', 'Yucay'],
    'Calca': ['Calca', 'Coya', 'Lamay', 'Lares', 'Pisac', 'San Salvador', 'Taray', 'Yanatile'],
    'Quispicanchi': ['Urcos', 'Andahuaylillas', 'Camanti', 'Ccatca', 'Lucre', 'Marcapata', 'Oropesa', 'Quiquijana'],
    'Canchis': ['Sicuani', 'Checacupe', 'Combapata', 'Marangani', 'Pitumarca', 'San Pablo', 'San Pedro', 'Tinta'],
    'Espinar': ['Yauri', 'Coporaque', 'Ocoruro', 'Pallpata', 'Pichigua', 'Suyckutambo']
  },
  'Ica': {
    'Ica': ['Ica', 'La Tinguiña', 'Los Aquijes', 'Ocucaje', 'Pachacutec', 'Parcona', 'Pueblo Nuevo', 'Salas', 'San José de los Molinos', 'San Juan Bautista', 'Santiago', 'Subtanjalla', 'Tate', 'Yauca del Rosario'],
    'Chincha': ['Chincha Alta', 'Alto Larán', 'Chavín', 'Chincha Baja', 'El Carmen', 'Grocio Prado', 'Pueblo Nuevo', 'Sunampe', 'Tambo de Mora'],
    'Pisco': ['Pisco', 'Huancano', 'Humay', 'Independencia', 'Paracas', 'San Andrés', 'San Clemente', 'Tupac Amaru Inca'],
    'Nazca': ['Nazca', 'Changuillo', 'El Ingenio', 'Marcona', 'Vista Alegre'],
    'Palpa': ['Palpa', 'Llipata', 'Río Grande', 'Santa Cruz', 'Tibillo']
  },
  'Cajamarca': {
    'Cajamarca': ['Cajamarca', 'Asunción', 'Chetilla', 'Cospán', 'Encañada', 'Jesús', 'Llacanora', 'Magdalena', 'San Juan', 'Baños del Inca'],
    'Jaén': ['Jaén', 'Bellavista', 'Chontalí', 'Colasay', 'Huabal', 'Las Pirias', 'Pomahuaca', 'Pucará', 'Sallique', 'San Felipe', 'San José del Alto'],
    'Chota': ['Chota', 'Anguía', 'Chadín', 'Chiguirip', 'Chimban', 'Cochabamba', 'Conchan', 'Huambos', 'Lajas', 'Paccha', 'Querocoto', 'Tacabamba'],
    'Cutervo': ['Cutervo', 'Callayuc', 'Cujillo', 'La Ramada', 'Querocotillo', 'San Andrés de Cutervo', 'Santo Domingo de la Capilla'],
    'Hualgayoc': ['Bambamarca', 'Chugur', 'Hualgayoc'],
    'Celendín': ['Celendín', 'Chumuch', 'Cortegana', 'Huasmin', 'Jorge Chávez', 'Sucre', 'Utco']
  },
  'Loreto': {
    'Maynas': ['Iquitos', 'Alto Nanay', 'Fernando Lores', 'Indiana', 'Las Amazonas', 'Mazan', 'Punchana', 'Torres Causana', 'Belén', 'San Juan Bautista'],
    'Alto Amazonas': ['Yurimaguas', 'Balsapuerto', 'Jeberos', 'Lagunas', 'Santa Cruz', 'Teniente César López Rojas'],
    'Loreto': ['Nauta', 'Parinari', 'Tigre', 'Urarinas'],
    'Mariscal Ramón Castilla': ['Ramón Castilla', 'Pebas', 'Yavarí', 'San Pablo'],
    'Requena': ['Requena', 'Capelo', 'Emilio San Martín', 'Maquia', 'Sapuena', 'Yaquerana'],
    'Datem del Marañón': ['Barranca', 'Cahuapanas', 'Manseriche', 'Morona', 'Pastaza', 'Andoas']
  },
  'San Martín': {
    'Moyobamba': ['Moyobamba', 'Calzada', 'Habana', 'Jepelacio', 'Yantalo', 'Soritor'],
    'Tarapoto (San Martín)': ['Tarapoto', 'Alberto Leveau', 'Cacatachi', 'Chazuta', 'Chipurana', 'El Porvenir', 'Morales', 'La Banda de Shilcayo', 'Juan Guerra', 'Shapaja'],
    'Rioja': ['Rioja', 'Awajún', 'Elias Soplin Vargas', 'Nueva Cajamarca', 'Pardo Miguel', 'Posic', 'Yorongos', 'Yuracyacu'],
    'Mariscal Cáceres': ['Juanjuí', 'Campanilla', 'Huicungo', 'Pachiza', 'Pajarillo'],
    'Tocache': ['Tocache', 'Nuevo Progreso', 'Pólvora', 'Shunte', 'Uchiza'],
    'Lamas': ['Lamas', 'Alonso de Alvarado', 'Barranquita', 'Caynarachi', 'Cuñumbuqui', 'Tabalosos', 'Zapatero']
  },
  'Puno': {
    'Puno': ['Puno', 'Acora', 'Amantaní', 'Chucuito', 'Coata', 'Laraqueri', 'Mañazo', 'Platería', 'San Antonio', 'Tiquillaca', 'Uros Chulluni'],
    'San Román': ['Juliaca', 'Cabana', 'Cabanillas', 'Caracoto', 'San Miguel'],
    'Chucuito': ['Juli', 'Desaguadero', 'Huacullani', 'Kelluyo', 'Pisacoma', 'Pomata', 'Zepita'],
    'Azángaro': ['Azángaro', 'Asillo', 'Caminaca', 'Chupa', 'Muñani', 'Potoni', 'Saman', 'San José'],
    'Huancané': ['Huancané', 'Cojata', 'Pusi', 'Rosaspata', 'Taraco'],
    'Melgar': ['Ayaviri', 'Antauta', 'Cupi', 'Llalli', 'Macari', 'Nuñoa', 'Orurillo', 'Santa Rosa']
  },
  'Tacna': {
    'Tacna': ['Tacna', 'Alto de la Alianza', 'Calana', 'Ciudad Nueva', 'Inclán', 'Pachía', 'Palca', 'Pocollay', 'Sama', 'Coronel Gregorio Albarracín Lanchipa'],
    'Jorge Basadre': ['Locumba', 'Ilabaya', 'Ite'],
    'Candarave': ['Candarave', 'Cairani', 'Camilaca', 'Curibaya', 'Huanuara', 'Quilahuani'],
    'Tarata': ['Tarata', 'Chucatamani', 'Estique', 'Estique-Pampa', 'Sitajara', 'Susapaya', 'Tarucachi', 'Ticaco']
  },
  'Huánuco': {
    'Huánuco': ['Huánuco', 'Amarilis', 'Chinchao', 'Churubamba', 'Margos', 'Pillco Marca', 'Quisqui', 'San Francisco de Asís', 'Santa María del Valle', 'Yacus'],
    'Leoncio Prado': ['Rupa-Rupa', 'Alania', 'Dámaso Beraún', 'José Crespo y Castillo', 'Luyando', 'Mariano Dámaso Beraún', 'Hermilio Valdizán']
  },
  'Ayacucho': {
    'Huamanga': ['Ayacucho', 'Acocro', 'Acos Vinchos', 'Carmen Alto', 'Chiara', 'Jesús Nazareno', 'Ocros', 'Pacaycasa', 'San Juan Bautista', 'Santiago de Pischa', 'Socos', 'Tambillo', 'Vinchos', 'Andrés Avelino Cáceres L.']
  },
  'Ucayali': {
    'Coronel Portillo': ['Callería', 'Campoverde', 'Iparía', 'Masisea', 'Yarinacocha', 'Nueva Requena', 'Manantay']
  },
  'Amazonas': {
    'Chachapoyas': ['Chachapoyas', 'Asunción', 'Balsas', 'Cheto', 'Conila', 'Granada', 'Huancas', 'La Jalca', 'Leymebamba', 'Magdalena', 'Mariscal Castilla', 'Molinopampa', 'Montevideo', 'Olleros', 'Quinjalca', 'San Francisco de Daguas', 'Santo Tomás', 'Soloco', 'Sonche']
  },
  'Apurímac': {
    'Abancay': ['Abancay', 'Chacoche', 'Circa', 'Curahuasi', 'Huanipaca', 'Lambrama', 'Pichirhua', 'San Pedro de Cachora', 'Tamburco'],
    'Andahuaylas': ['Andahuaylas', 'Andarapa', 'Chiara', 'Huancarama', 'Huancaray', 'Kishuara', 'Pacobamba', 'Pacucha', 'Pampachiri', 'San Jerónimo', 'Santa María de Chicmo', 'Talavera', 'Tumay Huaraca', 'Turpo']
  },
  'Huancavelica': {
    'Huancavelica': ['Huancavelica', 'Acobambilla', 'Acoria', 'Conayca', 'Cuenca', 'Huachocolpa', 'Huayllahuara', 'Izcuchaca', 'Laria', 'Manta', 'Mariscal Cáceres', 'Moya', 'Nuevo Occoro', 'Palca', 'Pilchaca', 'Vilca', 'Yauli']
  },
  'Madre de Dios': {
    'Tambopata': ['Tambopata', 'Inambari', 'Las Piedras', 'Laberinto']
  },
  'Moquegua': {
    'Mariscal Nieto': ['Moquegua', 'Carumas', 'Cuchumbaya', 'Samegua', 'San Cristóbal', 'Torata']
  },
  'Pasco': {
    'Pasco': ['Chaupimarca', 'Huachón', 'Huariaca', 'Huayllay', 'Ninacaca', 'Pallanchacra', 'Paucartambo', 'San Francisco de Asís de Yarusyacán', 'Simon Bolívar', 'Ticlacayán', 'Tinyahuarco', 'Vicentina']
  },
  'Tumbes': {
    'Tumbes': ['Tumbes', 'Corrales', 'La Cruz', 'Pampas de Hospital', 'San Jacinto', 'San Juan de la Virgen']
  }
};
