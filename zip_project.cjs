const fs = require('fs');
const archiver = require('archiver');
const output = fs.createWriteStream(__dirname + '/public/pos-commercial-ready.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

archive.on('error', function(err) { throw err; });
archive.pipe(output);

archive.glob('**/*', {
  ignore: ['node_modules/**', '.git/**', 'dist/**', 'public/pos-commercial-ready.zip', 'public/pos-commercial-ready.tar.gz', 'zip_project.js', '.next/**']
});

archive.finalize();
