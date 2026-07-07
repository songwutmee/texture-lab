precision highp float;

vec3 perm(vec3 x){return mod(((x*34.)+1.)*x,289.);}

// sin-free hash: stays uniform on GPUs where fract(sin(x)*43758.) breaks down
float hash21(vec2 p){
  vec3 q=fract(vec3(p.xyx)*vec3(443.897,441.423,437.195));
  q+=dot(q,q.yzx+19.19);
  return fract((q.x+q.y)*q.z);
}

// simplex noise, -1..1
float sn(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
  i=mod(i,289.);
  vec3 p=perm(perm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m=m*m; m=m*m;
  vec3 x2=2.*fract(p*C.www)-1.;
  vec3 h=abs(x2)-.5;
  vec3 ox=floor(x2+.5);
  vec3 a0=x2-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

float fbm(vec2 p,int o,float lac,float per){
  float v=0.,a=.5,s=0.;
  for(int i=0;i<8;i++){ if(i>=o)break; v+=a*sn(p); p*=lac; s+=a; a*=per; }
  return v/s;
}

float voronoi(vec2 p){
  vec2 ip=floor(p),fp=fract(p); float md=9.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 nb=vec2(float(x),float(y));
    vec2 r=fract(sin(vec2(dot(ip+nb,vec2(127.1,311.7)),dot(ip+nb,vec2(269.5,183.3))))*43758.5);
    r=.5+.5*sin(6.2832*r);
    md=min(md,length(nb+r-fp));
  }
  return md;
}

float worley(vec2 p){
  vec2 ip=floor(p),fp=fract(p); float d1=9.,d2=9.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    vec2 nb=vec2(float(x),float(y));
    vec2 r=fract(sin(vec2(dot(ip+nb,vec2(127.1,311.7)),dot(ip+nb,vec2(269.5,183.3))))*43758.5);
    r=.5+.5*sin(6.2832*r);
    float d=length(nb+r-fp);
    if(d<d1){d2=d1;d1=d;} else if(d<d2){d2=d;}
  }
  return clamp(d2-d1,0.,1.);
}

float ridge(vec2 p,int o,float lac,float per){
  float v=0.,a=.5,s=0.;
  for(int i=0;i<8;i++){ if(i>=o)break; v+=a*(1.-abs(sn(p))); p*=lac; s+=a; a*=per; }
  return v/s;
}

float curl(vec2 p){
  float e=.005;
  float a=fbm(vec2(p.x,p.y+e),3,2.,.5), b=fbm(vec2(p.x,p.y-e),3,2.,.5);
  float c=fbm(vec2(p.x+e,p.y),3,2.,.5), d=fbm(vec2(p.x-e,p.y),3,2.,.5);
  return length(vec2((a-b)/(2.*e),-(c-d)/(2.*e)))*.4+.3;
}

float erosion(vec2 p,int o,float lac,float per){
  float e=.005;
  float dx=(fbm(vec2(p.x+e,p.y),o,lac,per)-fbm(vec2(p.x-e,p.y),o,lac,per))/(2.*e);
  float dy=(fbm(vec2(p.x,p.y+e),o,lac,per)-fbm(vec2(p.x,p.y-e),o,lac,per))/(2.*e);
  return clamp(fbm(p+vec2(dx,dy)*.8,o,lac,per)*.5+.5,0.,1.);
}

float spots(vec2 p){
  float v=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 nb=vec2(float(x),float(y));
    vec2 r=fract(sin(vec2(dot(floor(p)+nb,vec2(127.1,311.7)),dot(floor(p)+nb,vec2(269.5,183.3))))*43758.5);
    r=.5+.5*r;
    float d=length(fract(p)-r-nb);
    v+=exp(-d*d*8.);
  }
  return clamp(v,0.,1.);
}

float value(vec2 p){
  vec2 i=floor(p),f=fract(p);
  float a=fract(sin(dot(i,            vec2(127.1,311.7)))*43758.5);
  float b=fract(sin(dot(i+vec2(1,0),  vec2(127.1,311.7)))*43758.5);
  float c=fract(sin(dot(i+vec2(0,1),  vec2(127.1,311.7)))*43758.5);
  float d=fract(sin(dot(i+vec2(1,1),  vec2(127.1,311.7)))*43758.5);
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
