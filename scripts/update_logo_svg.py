import base64

with open(r'e:\fleet\client\public\logo.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image width="512" height="512" href="data:image/png;base64,{b64}" />
</svg>
'''

with open(r'e:\fleet\client\public\logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

with open(r'e:\fleet\client\public\favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

print('SVG logo and favicon successfully generated!')
