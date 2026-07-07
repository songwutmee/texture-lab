uniform vec2  u_res;
uniform float u_rot,u_glow;
uniform float u_p1,u_p2,u_p3,u_p4;
uniform float u_nmix,u_nscale,u_noct,u_ndist,u_nseed,u_npolar;
uniform float u_cont,u_bri,u_inv;
uniform int   u_shape,u_ntype,u_blend,u_out;

float ringS(vec2 p){
  float d=abs(length(p)-u_p1)-u_p2*.5;
  return 1.-smoothstep(0.,max(u_p3,1e-3),d);
}

float spiralS(vec2 p){
  float r=length(p),a=atan(p.y,p.x);
  // archimedean arm: phase wraps as radius grows
  float v=abs(fract(a*.159155+r*u_p1)-.5)*2.;
  float arm=1.-smoothstep(u_p2*.5,u_p2*.5+max(u_p3,1e-3),v);
  return arm*(1.-smoothstep(.7,1.,r));
}

float webS(vec2 p){
  float r=length(p),a=atan(p.y,p.x);
  float spokes=max(floor(u_p1),3.);
  float sd=abs(fract(a*.159155*spokes+.5)-.5);      // 0 at spoke, .5 between
  float rw=r*(1.+u_p4*pow(sd*2.,2.));               // threads sag between spokes
  float spoke=1.-smoothstep(0.,max(u_p3,1e-4),sd*r*6.2832/spokes);
  float rings=max(floor(u_p2),2.);
  float rd=abs(fract(rw*rings+.5)-.5)/rings;
  float arc=1.-smoothstep(0.,max(u_p3,1e-4),rd);
  return max(spoke,arc)*(1.-smoothstep(.92,1.,rw));
}

float blobS(vec2 p){
  return 1.-smoothstep(u_p1-u_p2,u_p1+u_p2,length(p));
}

float streakS(vec2 p){
  float m=0.,n=max(u_p3,1.);
  for(int i=0;i<8;i++){
    if(float(i)>=n)break;
    float ang=3.14159*float(i)/n;
    float c=cos(ang),s=sin(ang);
    vec2 q=vec2(c*p.x+s*p.y,-s*p.x+c*p.y);
    m=max(m,exp(-q.y*q.y/max(u_p2*u_p2,1e-5))*exp(-q.x*q.x/max(u_p1*u_p1,1e-4)));
  }
  return m;
}

float radialS(vec2 p){
  return pow(clamp(1.-length(p)+u_p2,0.,1.),max(u_p1,.01));
}

float arcS(vec2 p){
  float r=length(p),ang=abs(atan(p.y,p.x));
  float sweep=max(u_p4,.02)*3.14159;
  float taper=1.-smoothstep(0.,sweep,ang);      // full thickness mid-swing, thin tips
  float d=abs(r-u_p1)-u_p2*.5*taper;
  return (1.-smoothstep(0.,max(u_p3,1e-3),d))*step(ang,sweep);
}

float raysS(vec2 p){
  float r=length(p),a=atan(p.y,p.x);
  float f=abs(fract(a*.159155*max(floor(u_p1),2.))-.5)*2.;
  float ray=1.-smoothstep(u_p2*.5,u_p2*.5+max(u_p3,1e-3),f);
  return ray*(1.-smoothstep(.5,1.,r))*smoothstep(u_p4,u_p4+.05,r);
}

float boltS(vec2 p){
  // vertical line pushed sideways by fbm; new seed = new strike
  float x=p.x-fbm(vec2(p.y*u_p3,u_nseed*.37),4,2.,.5)*u_p1;
  float core=exp(-x*x/max(u_p2*u_p2,1e-5));
  float halo=exp(-x*x/max(u_p2*u_p2*40.,1e-4))*u_p4;
  return clamp(core+halo,0.,1.)*(1.-smoothstep(.75,1.,abs(p.y)));
}

float hexS(vec2 p){
  vec2 q=p*max(u_p1,1.);
  vec2 a1=mod(q,vec2(1.,1.7320508))-vec2(.5,.8660254);
  vec2 a2=mod(q+vec2(.5,.8660254),vec2(1.,1.7320508))-vec2(.5,.8660254);
  vec2 g=dot(a1,a1)<dot(a2,a2)?a1:a2;
  g=abs(g);
  float d=max(dot(g,normalize(vec2(1.,1.7320508))),g.x);  // .5 at the cell edge
  float line=smoothstep(.5-u_p2-max(u_p3,1e-3),.5-u_p2,d);
  float r=length(p);
  return line*(1.+u_p4*2.*pow(min(r,1.),3.))*(1.-smoothstep(.9,1.,r));
}

float getShape(vec2 p){
  if(u_shape==0)return ringS(p);
  if(u_shape==1)return spiralS(p);
  if(u_shape==2)return webS(p);
  if(u_shape==3)return blobS(p);
  if(u_shape==4)return streakS(p);
  if(u_shape==6)return arcS(p);
  if(u_shape==7)return raysS(p);
  if(u_shape==8)return boltS(p);
  if(u_shape==9)return hexS(p);
  return radialS(p);
}

float getPattern(vec2 np){
  if(u_ntype==1)return ridge(np,int(u_noct),2.,.5);
  if(u_ntype==2)return voronoi(np);
  if(u_ntype==3)return curl(np);
  if(u_ntype==4)return hash21(np);
  return fbm(np,int(u_noct),2.,.5)*.5+.5;
}

float blendv(float s,float n){
  if(u_blend==1)return clamp(s+n*s,0.,1.);
  if(u_blend==2)return 1.-(1.-s)*(1.-n);
  if(u_blend==3)return s<.5 ? 2.*s*n : 1.-2.*(1.-s)*(1.-n);
  return s*n;
}

void main(){
  vec2 uv=(gl_FragCoord.xy/u_res)*2.-1.;
  float rot=u_rot*.0174533;
  float c=cos(rot),si=sin(rot);
  vec2 p=mat2(c,-si,si,c)*uv;

  // polar sampling walks a circle through the noise field, so the
  // pattern wraps around the shape with no seam at the angle jump
  vec2 np;
  if(u_npolar>.5){
    float a=atan(p.y,p.x),r=length(p);
    np=vec2(cos(a),sin(a))*(.35+r)*u_nscale*.6;
  }else{
    np=(p*.5+.5)*u_nscale;
  }
  np+=vec2(u_nseed*.01);

  // noise can push the shape outline around for organic edges
  if(u_ndist>0.){
    vec2 w=vec2(fbm(np,3,2.,.5),fbm(np+vec2(5.2,1.3),3,2.,.5));
    p+=w*u_ndist;
  }

  float s=getShape(p);
  float v=(u_nmix>0.) ? mix(s,blendv(s,getPattern(np)),u_nmix) : s;

  // soft radial core, for flashes and flares
  if(u_glow>0.)v=max(v,pow(clamp(1.-length(p),0.,1.),3.)*u_glow);

  v=pow(clamp(v,0.,1.),1./max(u_cont,0.01))*u_cont;
  v=clamp(v+u_bri,0.,1.);
  if(u_inv>0.5)v=1.-v;
  v=clamp(v,0.,1.);

  if(u_out==1)      gl_FragColor=vec4(1.,1.,1.,v);   // white + alpha, ready for particles
  else if(u_out==2) gl_FragColor=vec4(v,v,v,v);
  else              gl_FragColor=vec4(v,v,v,1.);
}
