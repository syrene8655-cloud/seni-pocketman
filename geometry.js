const geometry = [{"id": "chassis", "b": {"x": 24.24, "y": -3.76, "width": 688.2408, "height": 492.7284}, "z": 0, "asset": "assets/chassis-unbranded-v1.png", "origin": null}, {"id": "cassette-surround", "b": {"x": 124.0234375, "y": 103.515625, "width": 502.9296875, "height": 241.69921875}, "z": 10, "asset": "assets/cassette-surround.bf8e601efd28.webp", "origin": null}, {"id": "cassette-shell", "b": {"x": 147.94921875, "y": 107.421875, "width": 457.03125, "height": 236.328125}, "z": 20, "asset": "assets/cassette-shell.3d71f41337e9.webp", "origin": null}, {"id": "album-label", "b": {"x": 169.921875, "y": 120.1171875, "width": 413.57421875, "height": 166.9921875}, "z": 30, "asset": "assets/album-label.f038d7dc76ca.webp", "origin": null}, {"id": "tape-left", "b": {"x": 234.86328125, "y": 165.52734375, "width": 126.953125, "height": 96.6796875}, "z": 40, "asset": "assets/tape-left.5b8d2971a37e.webp", "origin": null}, {"id": "tape-right", "b": {"x": 409.1796875, "y": 168.45703125, "width": 102.5390625, "height": 90.33203125}, "z": 40, "asset": "assets/tape-right.da3b7f81907e.webp", "origin": null}, {"id": "hub-left", "b": {"x": 244.140625, "y": 177.24609375, "width": 82.03125, "height": 81.0546875}, "z": 50, "asset": "assets/hub-left.9a55cca2b0bc.webp", "origin": [84, 82]}, {"id": "hub-right", "b": {"x": 424.31640625, "y": 177.24609375, "width": 82.03125, "height": 81.0546875}, "z": 50, "asset": "assets/hub-right.9b28f17554f4.webp", "origin": [83, 82]}, {"id": "door-frame", "b": {"x": 115.72265625, "y": 94.7265625, "width": 521.97265625, "height": 258.7890625}, "z": 60, "asset": "assets/door-frame.0ebbb4921685.webp", "origin": null}, {"id": "display", "b": {"x": 160.64453125, "y": 360.3515625, "width": 429.6875, "height": 38.0859375}, "z": 70, "asset": "assets/display.7201f5037373.webp", "origin": null}, {"id": "button-prev", "b": {"x": 160.64453125, "y": 397.94921875, "width": 131.8359375, "height": 49.8046875}, "z": 70, "asset": "assets/button-prev.601edc8c746a.webp", "origin": null}, {"id": "button-play", "b": {"x": 305.17578125, "y": 397.94921875, "width": 139.16015625, "height": 49.8046875}, "z": 70, "asset": "assets/button-play.870d9b1dd7a6.webp", "origin": null}, {"id": "button-next", "b": {"x": 457.51953125, "y": 397.94921875, "width": 132.8125, "height": 49.8046875}, "z": 70, "asset": "assets/button-next.adfb1ef0f5b0.webp", "origin": null}, {"id": "button-stop", "b": {"x": 517.8972, "y": 16.2092, "width": 50.6196, "height": 16.254}, "z": 70, "asset": "assets/button-stop.ad604413d801.webp", "origin": null}, {"id": "button-eject", "b": {"x": 580.1268, "y": 16.2092, "width": 51.084, "height": 16.254}, "z": 70, "asset": "assets/button-eject.fae14543f5c8.webp", "origin": null}, {"id": "volume-wheel", "b": {"x": 678.22265625, "y": 56.640625, "width": 19.53125, "height": 76.66015625}, "z": 70, "asset": "assets/volume-wheel.5291a959f2db.webp", "origin": null}];

// Photo calibration in original 1024 x 1536 image coordinates.
// The rack's front rails descend slightly to the right, increasingly down the rack.
const rackCamera={front:[[118,195],[835,199],[832,1420],[118,1396]],source:[118,195,717,1201],depthVanishing:[2300,-540],depth:.035};
function quadHomography(points){
 const [p0,p1,p2,p3]=points,dx1=p1[0]-p2[0],dx2=p3[0]-p2[0],dx3=p0[0]-p1[0]+p2[0]-p3[0],dy1=p1[1]-p2[1],dy2=p3[1]-p2[1],dy3=p0[1]-p1[1]+p2[1]-p3[1],det=dx1*dy2-dx2*dy1;
 const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
 return [p1[0]-p0[0]+g*p1[0],p3[0]-p0[0]+h*p3[0],p0[0],p1[1]-p0[1]+g*p1[1],p3[1]-p0[1]+h*p3[1],p0[1],g,h];
}
const rackFrontMap=quadHomography(rackCamera.front);
function projectRackPoint(x,y,depth=0){
 const [sx,sy,sw,sh]=rackCamera.source,u=(x-sx)/sw,v=(y-sy)/sh,[a,b,c,d,e,f,g,h]=rackFrontMap,z=depth*rackCamera.depth,den=g*u+h*v+1+z;
 return [(a*u+b*v+c+z*rackCamera.depthVanishing[0])/den,(d*u+e*v+f+z*rackCamera.depthVanishing[1])/den];
}
function quadCSSMatrix(points,width,height){
 const [a,b,c,d,e,f,g,h]=quadHomography(points);
 return 'matrix3d('+[a/width,d/width,0,g/width,b/height,e/height,0,h/height,0,0,1,0,c,f,0,1].join(',')+')';
}
function projectRackCase(x,y,width,height,scale){
 // Far-offscreen rows must never cross the camera horizon or grow scroll overflow.
 if(y+height<0||y>1536*scale)return null;
 const corners=[[x,y],[x+width,y],[x+width,y+height],[x,y+height]];
 const face=depth=>corners.map(([px,py])=>projectRackPoint(px/scale,py/scale,depth).map((n,i)=>n*scale-(i?y:x)));
 const front=face(0),back=face(1);
 const surfaceDepth=width*.63;
 return {front,back,surfaceDepth,frontMatrix:quadCSSMatrix(front,width,height),topMatrix:quadCSSMatrix([back[0],back[1],front[1],front[0]],width,surfaceDepth),sideMatrix:quadCSSMatrix([front[1],back[1],back[2],front[2]],surfaceDepth,height),pull:[-(back[0][0]-front[0][0])*.72,-(back[0][1]-front[0][1])*.72]};
}
