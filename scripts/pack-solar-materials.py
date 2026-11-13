"""Embed an artist-supplied clean PNG as a second named solar material, losslessly."""
import argparse, copy, json, struct
from pathlib import Path

def pack(source: Path, clean: Path, output: Path):
    blob=source.read_bytes()
    magic,version,total=struct.unpack_from('<4sII',blob)
    if magic!=b'glTF' or version!=2 or total!=len(blob): raise ValueError('Expected a complete GLB v2 file')
    length,kind=struct.unpack_from('<I4s',blob,12)
    if kind!=b'JSON': raise ValueError('Missing JSON chunk')
    doc=json.loads(blob[20:20+length]); start=20+length
    binary_length,binary_kind=struct.unpack_from('<I4s',blob,start)
    if binary_kind!=b'BIN\0': raise ValueError('Missing binary chunk')
    binary=bytearray(blob[start+8:start+8+binary_length]);png=clean.read_bytes()
    if png[:8]!=b'\x89PNG\r\n\x1a\n': raise ValueError('Clean atlas must be a PNG file')
    if len(doc.get('materials',[]))!=1: raise ValueError('Use the original one-material SolarPanel.glb as source')
    old_image=doc['images'][0];view=doc['bufferViews'][old_image['bufferView']];offset=view.get('byteOffset',0);dirty_png=bytes(binary[offset:offset+view['byteLength']])
    if struct.unpack_from('>II',png,16)!=struct.unpack_from('>II',dirty_png,16): raise ValueError('Clean and dirty atlas dimensions must match')
    binary.extend(b'\0'*((-len(binary))%4));offset=len(binary);binary.extend(png)
    doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(png)})
    image_index=len(doc['images']);doc['images'].append({'name':'Solar panel clean','mimeType':'image/png','bufferView':len(doc['bufferViews'])-1})
    texture_index=len(doc['textures']);texture=copy.deepcopy(doc['textures'][0]);texture['source']=image_index;doc['textures'].append(texture)
    dirty=doc['materials'][0];dirty['name']='Solar panel dirty';clean_mat=copy.deepcopy(dirty);clean_mat['name']='Solar panel clean';clean_mat['pbrMetallicRoughness']['baseColorTexture']['index']=texture_index;doc['materials'].append(clean_mat)
    doc.setdefault('extensions',{})['KHR_materials_variants']={'variants':[{'name':'Clean'},{'name':'Dirty'}]}
    doc.setdefault('extensionsUsed',[]).append('KHR_materials_variants')
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            primitive['material']=1
            primitive.setdefault('extensions',{})['KHR_materials_variants']={'mappings':[{'material':1,'variants':[0]},{'material':0,'variants':[1]}]}
    doc['buffers'][0]['byteLength']=len(binary)
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);binary.extend(b'\0'*((-len(binary))%4))
    result=struct.pack('<4sII',b'glTF',2,12+8+len(encoded)+8+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    output.parent.mkdir(parents=True,exist_ok=True);temporary=output.with_suffix('.tmp');temporary.write_bytes(result);temporary.replace(output)
    print('Packed both named materials and standard Clean/Dirty variants; original geometry, UVs and PNG pixels preserved.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=Path,required=True);parser.add_argument('--clean',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();pack(args.source,args.clean,args.output)
