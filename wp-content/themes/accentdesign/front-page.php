<div class="container">
  <div style="background: url('http://198.58.102.147/accentdesign/wp-content/uploads/2016/12/IMG_2823_new-1.jpg'); height: 100%; background-attachment: fixed; background-position: center; background-repeat: no-repeat; background-size: cover;" >
    <?php get_header(); ?>
    <div class="headline">
      <h1 class="text-center" style="color: white; font-size: 50px;">WHAT IS YOUR VISION?</h1>
      <p class="text-center" style="color: white;">
        We're a Honolulu, Hawaii home design and remodeling company collaboratively combining our expertise and your concepts to turn vision into reality.
      </p>
    </div>
    <div class="arrow">
      <img src="http://198.58.102.147/accentdesign/wp-content/uploads/2016/12/arrow-down@2x.png" alt="Arrow Down" width="100px" style="position: absolute; top: 90%; left: 50%; transform: translateX(-50%) translateY(-50%);" />
    </div>
  </div>
</div>

<?php

$args = array(
  'post_type' => 'project'
);
$query = new WP_Query ($args);

 ?>

<section class="row no-max collapse" id='projects' style="padding: 0; margin: 0; background: #4d4d4d;">
  <br><br><br><br><br>
  <h1 class="text-center" style="font-size: 50px; padding-bottom: 0; color: white;">PROJECTS<br><span style="border-bottom: 1px solid white; padding: 0; margin: 0; line-height: 0; font-size:16px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></h1>
  <br><br><br><br><br>
  <?php if( $query->have_posts() ) : while($query->have_posts() ) : $query->the_post(); ?>
    <div class="small-12 medium-6 large-6 columns " style="padding: 0; margin: 0;">
    <style>
      .project-image:hover{ background: black;}
      .project-image:hover img{ opacity:0.5;}
      .project-image:hover h1{display:block !important; font-size:400%; text-transform: uppercase; text-align: center; position: absolute; top: 30%; width: 100%; color: white;}
      @media screen and (max-width: 768px){
        .project-image{ background: black;}
        .project-image img{ opacity:0.5;}
        .project-image h1{display:block !important; font-size:400%; text-transform: uppercase; text-align: center; position: absolute; top: 30%; width: 100%; color: white;}
      }
    </style>
      <div class="project-image transition" style="padding: 0; margin: 0;">
        <a href="<?php the_permalink(); ?>"><?php the_post_thumbnail('large'); ?></a>
        <h1 style="display: none; "><?php the_title(); ?></h1><br>
      </div>
    </div>
  <?php endwhile; endif; wp_reset_postdata(); ?>
</section>


<!-- <div class="container">
  <div style="background: url('http://localhost/accent_design/wp-content/uploads/2016/10/clients.png'); height: 100%; background-attachment: fixed; background-position: center; background-repeat: no-repeat; background-size: cover;">
    <div class="row">
      <div class="testimonials" style="margin-top: 20%;">
        <h1 class="text-center" style="color: white;">MEET JEFF</h1>
        <br><br>
        <p style="color: white;">
          Island life and culture are an everyday part of Jeff’s work and play. At a very young age, he helped build his family’s home, learning while working alongside his father and grandfather. He continued to gain hands-on experience in design and construction growing up, which still guides him today. His training in building allows him to create practical and beautiful designs that are also economical to construct.
        <br>
        </p>
        <p style="color: white;">
          Hawaii has a unique domestic lifestyle where homes and living spaces occasionally need to accommodate multi-generational families. Jeff takes a family’s lifestyle into consideration to maintain the functionality of a home while keeping an eye to the family’s preferred aesthetics.
        <br>
        </p>
        <p style="color: white;">
          Jeff believes Hawaii is the ideal location for him, given his love of nature and outdoor adventure. He can be found hiking, scuba diving, and outrigger paddling often, not to mention just enjoying life. The beauty and history of Hawaii inspires his creativity as a designer, and his continual growth as a person.
        <br>
        </p>
      </div>
    </div>
  </div>
</div> -->

<?php get_footer(); ?>
